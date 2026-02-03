/**
 * Fuzz test runner
 *
 * Executes fuzz tests with seeded random action generation.
 */

import type { Surface } from '../surfaces/types.js'
import type { Generator } from './generator.js'
import type { Invariants } from '../invariants/dsl.js'
import { generateAction } from './generator.js'
import { checkInvariants } from '../invariants/dsl.js'
import { createSeededRandom, type SeededRandom } from '../random.js'

export interface FuzzRunResult {
  passed: boolean
  seed: number
  steps: number
  actions: string[]
  failure?: {
    step: number
    action: string
    invariant: string
    message: string
    state: unknown
  }
}

export interface FuzzRunOptions {
  seed?: number
  maxSteps?: number
  onStep?: (step: number, action: string, state: unknown) => void
}

/**
 * Run a single fuzz test
 */
export async function runFuzz<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  generator: Generator<Action>,
  invariants: Invariants<State>,
  options: FuzzRunOptions = {}
): Promise<FuzzRunResult> {
  const seed = options.seed ?? Date.now()
  const maxSteps = options.maxSteps ?? generator.maxSteps
  const random = createSeededRandom(seed)

  const actions: string[] = []
  const instance = surface.create()

  try {
    // Check initial state
    let state = surface.getState(instance)
    let check = checkInvariants(invariants, state)

    if (!check.passed) {
      return {
        passed: false,
        seed,
        steps: 0,
        actions: [],
        failure: {
          step: 0,
          action: '(initial)',
          invariant: check.firstFailure!.name,
          message: check.firstFailure!.message,
          state,
        },
      }
    }

    // Run action loop
    for (let step = 1; step <= maxSteps; step++) {
      const action = generateAction(generator, random, state)

      // No available actions (all preconditions failed) - end early
      if (action === null) {
        break
      }

      actions.push(action)

      options.onStep?.(step, action, state)

      // Execute action
      await surface.sendAction(instance, action)

      // Check invariants
      state = surface.getState(instance)
      check = checkInvariants(invariants, state)

      if (!check.passed) {
        return {
          passed: false,
          seed,
          steps: step,
          actions: [...actions],
          failure: {
            step,
            action,
            invariant: check.firstFailure!.name,
            message: check.firstFailure!.message,
            state,
          },
        }
      }
    }

    return {
      passed: true,
      seed,
      steps: actions.length,
      actions,
    }
  } finally {
    await surface.dispose?.(instance)
  }
}

/**
 * Run multiple fuzz iterations
 */
export async function runFuzzIterations<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  generator: Generator<Action>,
  invariants: Invariants<State>,
  options: {
    iterations?: number
    baseSeed?: number
    failFast?: boolean
    onIteration?: (iteration: number, result: FuzzRunResult) => void
  } = {}
): Promise<{
  passed: boolean
  iterations: number
  failures: FuzzRunResult[]
}> {
  const iterations = options.iterations ?? 100
  const baseSeed = options.baseSeed ?? Date.now()
  const failFast = options.failFast ?? true
  const baseRandom = createSeededRandom(baseSeed)

  const failures: FuzzRunResult[] = []

  for (let i = 0; i < iterations; i++) {
    const iterationSeed = baseRandom.int(0, 2 ** 31 - 1)
    const result = await runFuzz(surface, generator, invariants, { seed: iterationSeed })

    options.onIteration?.(i, result)

    if (!result.passed) {
      failures.push(result)
      if (failFast) {
        return { passed: false, iterations: i + 1, failures }
      }
    }
  }

  return {
    passed: failures.length === 0,
    iterations,
    failures,
  }
}
