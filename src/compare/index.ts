/**
 * Model comparison utilities
 *
 * Run the same surface with different action choosers and compare results.
 * Useful for evaluating different testing strategies.
 */

import type { Surface } from '../surfaces/types.js'
import type { Invariants } from '../invariants/dsl.js'
import type { ActionChooser, ChooserRunResult } from '../chooser/index.js'
import { runWithChooser } from '../chooser/index.js'
import { checkInvariants } from '../invariants/dsl.js'

/**
 * Result of running a single chooser
 */
export interface ChooserEvalResult<Action> {
  chooser: string
  runResult: ChooserRunResult<Action>
  passed: boolean
  failure?: {
    step: number
    action: Action
    invariant: string
    message: string
  }
}

/**
 * Result of comparing multiple choosers
 */
export interface ComparisonResult<Action> {
  results: ChooserEvalResult<Action>[]
  allPassed: boolean
  bestChooser?: string
  summary: {
    chooser: string
    passed: boolean
    steps: number
    stalled: boolean
  }[]
}

/**
 * Run a surface with multiple choosers and compare results
 *
 * @example
 * ```typescript
 * const results = await compareChoosers(surface, invariants, [
 *   createRandomChooser(generator, random1),
 *   createAiChooser({ model: 'gpt-4', ... }),
 *   createReplayChooser(['a', 'b', 'c']),
 * ], { maxSteps: 50 })
 *
 * console.log(results.summary)
 * // [
 * //   { chooser: 'random', passed: true, steps: 50, stalled: false },
 * //   { chooser: 'ai:gpt-4', passed: false, steps: 12, stalled: false },
 * //   { chooser: 'replay', passed: true, steps: 3, stalled: true },
 * // ]
 * ```
 */
export async function compareChoosers<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  invariants: Invariants<State>,
  choosers: ActionChooser<Action>[],
  options: { maxSteps: number }
): Promise<ComparisonResult<Action>> {
  const results: ChooserEvalResult<Action>[] = []

  for (const chooser of choosers) {
    chooser.reset?.()

    // Create a fresh instance for this chooser
    const instance = surface.create()
    const actions: Action[] = []

    try {
      let state = surface.getState(instance)

      // Check initial state
      let check = checkInvariants(invariants, state)
      if (!check.passed) {
        results.push({
          chooser: chooser.name,
          runResult: { actions: [], steps: 0, stalled: false },
          passed: false,
          failure: {
            step: 0,
            action: '(initial)' as Action,
            invariant: check.firstFailure!.name,
            message: check.firstFailure!.message,
          },
        })
        continue
      }

      let step = 0
      let stalled = false

      for (step = 1; step <= options.maxSteps; step++) {
        const action = await chooser.choose(state)

        if (action === null) {
          stalled = true
          step-- // Don't count stalled step
          break
        }

        actions.push(action)
        await surface.sendAction(instance, action)
        state = surface.getState(instance)

        check = checkInvariants(invariants, state)
        if (!check.passed) {
          results.push({
            chooser: chooser.name,
            runResult: { actions, steps: step, stalled: false },
            passed: false,
            failure: {
              step,
              action,
              invariant: check.firstFailure!.name,
              message: check.firstFailure!.message,
            },
          })
          break
        }
      }

      // Completed without failure
      if (check.passed) {
        results.push({
          chooser: chooser.name,
          runResult: { actions, steps: stalled ? step : options.maxSteps, stalled },
          passed: true,
        })
      }
    } finally {
      await surface.dispose?.(instance)
    }
  }

  // Build summary
  const summary = results.map((r) => ({
    chooser: r.chooser,
    passed: r.passed,
    steps: r.runResult.steps,
    stalled: r.runResult.stalled,
  }))

  const allPassed = results.every((r) => r.passed)

  // Best chooser: the one that found a bug (if any), or the one with most steps
  const failedChoosers = results.filter((r) => !r.passed)
  const bestChooser =
    failedChoosers.length > 0
      ? failedChoosers.sort((a, b) => a.runResult.steps - b.runResult.steps)[0].chooser
      : results.sort((a, b) => b.runResult.steps - a.runResult.steps)[0]?.chooser

  return {
    results,
    allPassed,
    bestChooser,
    summary,
  }
}

/**
 * Run multiple iterations with a chooser and track bug discovery
 */
export interface DiscoveryStats {
  chooser: string
  iterations: number
  bugsFound: number
  uniqueBugs: number
  totalSteps: number
  averageStepsToFailure: number
}

export async function measureDiscovery<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  invariants: Invariants<State>,
  chooser: ActionChooser<Action>,
  options: { iterations: number; maxSteps: number }
): Promise<DiscoveryStats> {
  const bugInvariants = new Set<string>()
  let bugsFound = 0
  let totalSteps = 0
  let stepsToFailure = 0
  let failureCount = 0

  for (let i = 0; i < options.iterations; i++) {
    chooser.reset?.()
    const instance = surface.create()

    try {
      let state = surface.getState(instance)
      let step = 0

      for (step = 1; step <= options.maxSteps; step++) {
        const action = await chooser.choose(state)
        if (action === null) break

        await surface.sendAction(instance, action)
        state = surface.getState(instance)

        const check = checkInvariants(invariants, state)
        if (!check.passed) {
          bugsFound++
          bugInvariants.add(check.firstFailure!.name)
          stepsToFailure += step
          failureCount++
          break
        }
      }

      totalSteps += step
    } finally {
      await surface.dispose?.(instance)
    }
  }

  return {
    chooser: chooser.name,
    iterations: options.iterations,
    bugsFound,
    uniqueBugs: bugInvariants.size,
    totalSteps,
    averageStepsToFailure: failureCount > 0 ? stepsToFailure / failureCount : 0,
  }
}
