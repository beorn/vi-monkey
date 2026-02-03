/**
 * AI harness for LLM-driven testing
 *
 * Two modes:
 * 1. Batch mode (default): Generate N scenarios upfront, execute all
 * 2. Interactive mode: LLM picks actions one at a time (expensive)
 *
 * Batch mode is preferred for efficiency.
 */

import type { Surface } from '../surfaces/types.js'
import type { Invariants } from '../invariants/dsl.js'
import type { Generator } from '../fuzz/generator.js'
import { checkInvariants } from '../invariants/dsl.js'
import { buildSystemContext, type SystemContext } from './introspect.js'
import {
  generateTestScenarios,
  type TestScenario,
  type BatchGenerationOptions,
} from './batch.js'

export interface AiHarnessOptions {
  /** LLM model to use */
  model: string
  /** Temperature (0 = deterministic) */
  temperature: number
  /** For batch mode: number of scenarios to generate */
  scenarioCount: number
  /** Maximum actions per scenario */
  maxActionsPerScenario: number
  /** Token budget for LLM calls */
  maxTokens: number
  /** Directory to save findings */
  saveDir?: string
  /** Provider */
  provider: 'openai' | 'anthropic' | 'claude-code'
  /** User-provided exploration focus hints */
  focus?: string[]
  /** System description (helps LLM understand what it's testing) */
  description?: string
}

export const defaultAiOptions: AiHarnessOptions = {
  model: 'claude-sonnet',
  temperature: 0,
  scenarioCount: 10,
  maxActionsPerScenario: 20,
  maxTokens: 10000,
  provider: 'anthropic',
}

export interface AiStep {
  step: number
  action: string
  state: unknown
  invariantsPassed: boolean
  failedInvariant?: string
  /** Optional reasoning for this step (used when generating tests) */
  reasoning?: string
}

export interface ScenarioResult {
  scenario: TestScenario
  passed: boolean
  steps: AiStep[]
  failure?: {
    step: number
    action: string
    invariant: string
    message: string
  }
}

export interface AiRunResult {
  passed: boolean
  scenarios: ScenarioResult[]
  tokensUsed: number
  model: string
  /** Scenarios that found bugs (for regression test generation) */
  findings: ScenarioResult[]
}

/**
 * Run AI-driven exploration using batch generation
 *
 * 1. Introspects the surface to build system context
 * 2. Generates N test scenarios via single LLM call
 * 3. Executes all scenarios, checking invariants
 * 4. Returns findings (failures) for regression test generation
 */
export async function runAiExploration<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  actions: readonly Action[],
  invariants: Invariants<State>,
  options: Partial<AiHarnessOptions> = {},
  generator?: Generator<Action>
): Promise<AiRunResult> {
  const opts = { ...defaultAiOptions, ...options }

  // Build system context for LLM
  const context = buildSystemContext(surface, actions, invariants, {
    description: opts.description,
    generator,
    focus: opts.focus,
  })

  // Generate test scenarios via LLM (single API call)
  const batchResult = await generateTestScenarios(context, {
    count: opts.scenarioCount,
    maxActionsPerScenario: opts.maxActionsPerScenario,
    model: opts.model,
    temperature: opts.temperature,
    provider: opts.provider,
  })

  // Execute all scenarios
  const scenarioResults: ScenarioResult[] = []

  for (const scenario of batchResult.scenarios) {
    const result = await executeScenario(surface, scenario, invariants)
    scenarioResults.push(result)
  }

  // Collect findings (failures)
  const findings = scenarioResults.filter((r) => !r.passed)

  return {
    passed: findings.length === 0,
    scenarios: scenarioResults,
    tokensUsed: batchResult.tokensUsed,
    model: batchResult.model,
    findings,
  }
}

/**
 * Execute a single test scenario
 */
async function executeScenario<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  scenario: TestScenario,
  invariants: Invariants<State>
): Promise<ScenarioResult> {
  const instance = surface.create()
  const steps: AiStep[] = []

  try {
    // Check initial state
    let state = surface.getState(instance)
    let check = checkInvariants(invariants, state)

    if (!check.passed) {
      return {
        scenario,
        passed: false,
        steps: [],
        failure: {
          step: 0,
          action: '(initial)',
          invariant: check.firstFailure!.name,
          message: check.firstFailure!.message,
        },
      }
    }

    // Execute action sequence
    for (let i = 0; i < scenario.actions.length; i++) {
      const action = scenario.actions[i] as Action

      try {
        await surface.sendAction(instance, action)
      } catch (error) {
        // Action threw - treat as failure
        return {
          scenario,
          passed: false,
          steps,
          failure: {
            step: i + 1,
            action,
            invariant: '(exception)',
            message: error instanceof Error ? error.message : String(error),
          },
        }
      }

      state = surface.getState(instance)
      check = checkInvariants(invariants, state)

      steps.push({
        step: i + 1,
        action,
        state,
        invariantsPassed: check.passed,
        failedInvariant: check.firstFailure?.name,
      })

      if (!check.passed) {
        return {
          scenario,
          passed: false,
          steps,
          failure: {
            step: i + 1,
            action,
            invariant: check.firstFailure!.name,
            message: check.firstFailure!.message,
          },
        }
      }
    }

    return {
      scenario,
      passed: true,
      steps,
    }
  } finally {
    await surface.dispose?.(instance)
  }
}

/**
 * Run AI exploration with user-directed focus
 *
 * @example
 * ```typescript
 * const result = await exploreWithFocus(surface, actions, invariants, {
 *   focus: [
 *     'boundary conditions when list is empty',
 *     'rapid repeated actions',
 *     'cursor movement at edges',
 *   ]
 * })
 * ```
 */
export async function exploreWithFocus<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  actions: readonly Action[],
  invariants: Invariants<State>,
  options: Partial<AiHarnessOptions> & { focus: string[] }
): Promise<AiRunResult> {
  return runAiExploration(surface, actions, invariants, options)
}
