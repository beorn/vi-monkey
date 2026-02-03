/**
 * Fuzz testing exports
 */

export {
  defineGenerator,
  generateAction,
  getAvailableActions,
  type Generator,
  type GeneratorConfig,
  type Precondition,
} from './generator.js'
export { runFuzz, runFuzzIterations, type FuzzRunResult, type FuzzRunOptions } from './runner.js'
export { shrinkSequence, type ShrinkResult, type ShrinkOptions } from './shrink.js'
export { defaultFuzzOptions, type FuzzModeOptions } from './mode.js'

import type { Surface } from '../surfaces/types.js'
import type { Generator } from './generator.js'
import type { Invariants } from '../invariants/dsl.js'
import { runFuzz, type FuzzRunResult } from './runner.js'
import { shrinkSequence } from './shrink.js'
import { parseSeed } from '../random.js'

export interface FuzzOptions {
  /** Number of iterations (default: 1) */
  iterations?: number
  /** Seed for reproducibility (default: from env or random) */
  seed?: number
  /** Whether to shrink failing sequences (default: true) */
  shrink?: boolean
  /** Maximum shrinking attempts (default: 100) */
  maxShrinkAttempts?: number
}

/**
 * Run a fuzz test inline
 *
 * @example
 * ```typescript
 * import { fuzz } from 'vitestx'
 *
 * test('counter invariants hold', async () => {
 *   const result = await fuzz(surface, generator, invariants)
 *   expect(result.passed).toBe(true)
 * })
 * ```
 */
export async function fuzz<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  generator: Generator<Action>,
  invariants: Invariants<State>,
  options: FuzzOptions = {}
): Promise<FuzzRunResult & { shrunk?: string[] }> {
  const {
    iterations = 1,
    seed = parseSeed('env'),
    shrink = true,
    maxShrinkAttempts = 100,
  } = options

  // Run fuzz test
  const result = await runFuzz(surface, generator, invariants, {
    seed,
    maxSteps: generator.maxSteps,
  })

  // Shrink if failed
  if (!result.passed && shrink && result.actions.length > 0) {
    const shrinkResult = await shrinkSequence(
      surface,
      invariants,
      result.actions,
      result.failure!.invariant,
      { maxAttempts: maxShrinkAttempts }
    )
    return { ...result, shrunk: shrinkResult.shrunk }
  }

  return result
}
