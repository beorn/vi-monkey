/**
 * Generator DSL for fuzz testing
 *
 * Defines how to generate random action sequences.
 */

import type { SeededRandom } from '../random.js'

/**
 * Precondition function type
 * Returns true if the action can be taken in the given state
 */
export type Precondition<State> = (state: State) => boolean

/**
 * Generator interface for fuzz testing
 *
 * @typeParam Action - The action type to generate
 */
export interface Generator<Action> {
  /** Available actions */
  actions: readonly Action[]

  /** Relative weights for action selection (higher = more likely) */
  weights?: Partial<Record<Action & string, number>>

  /** Preconditions for actions (action is skipped if precondition returns false) */
  preconditions?: Partial<Record<Action & string, Precondition<unknown>>>

  /** Maximum steps per test run */
  maxSteps: number

  /**
   * Custom action generation (advanced)
   * If provided, called instead of default weighted pick
   */
  generate?(random: SeededRandom, state: unknown): Action
}

/**
 * Configuration for defineGenerator
 */
export interface GeneratorConfig<Action, State = unknown> {
  /** Available actions */
  actions: readonly Action[]

  /** Relative weights (optional, defaults to uniform) */
  weights?: Partial<Record<Action & string, number>>

  /**
   * Preconditions for actions (optional)
   * If provided, action is only selected when its precondition returns true
   */
  preconditions?: Partial<Record<Action & string, Precondition<State>>>

  /** Maximum steps per run (default: 100) */
  maxSteps?: number

  /** Custom generation function (optional) */
  generate?(random: SeededRandom, state: State): Action
}

/**
 * Define a generator for fuzz testing
 *
 * @example
 * ```typescript
 * // Simple generator with uniform distribution
 * const generator = defineGenerator({
 *   actions: ['j', 'k', 'Enter', 'Escape'],
 *   maxSteps: 100,
 * })
 *
 * // Weighted generator
 * const generator = defineGenerator({
 *   actions: ['j', 'k', 'Enter', 'Escape'],
 *   weights: { j: 10, k: 10, Enter: 5, Escape: 1 },
 *   maxSteps: 100,
 * })
 *
 * // State-dependent generator
 * const generator = defineGenerator({
 *   actions: ['move', 'attack', 'heal'],
 *   generate(random, state) {
 *     if (state.health < 20) {
 *       return random.pick(['heal', 'heal', 'move'])
 *     }
 *     return random.pick(this.actions)
 *   },
 *   maxSteps: 200,
 * })
 * ```
 */
export function defineGenerator<Action, State = unknown>(
  config: GeneratorConfig<Action, State>
): Generator<Action> {
  return {
    actions: config.actions,
    weights: config.weights,
    preconditions: config.preconditions as Generator<Action>['preconditions'],
    maxSteps: config.maxSteps ?? 100,
    generate: config.generate as Generator<Action>['generate'],
  }
}

/**
 * Get actions that pass their preconditions for the current state
 *
 * @internal
 */
export function getAvailableActions<Action extends string>(
  generator: Generator<Action>,
  state: unknown
): readonly Action[] {
  if (!generator.preconditions) {
    return generator.actions
  }

  return generator.actions.filter((action) => {
    const precondition = generator.preconditions?.[action as keyof typeof generator.preconditions]
    return precondition ? precondition(state) : true
  })
}

/**
 * Generate the next action using the generator
 *
 * @internal
 */
export function generateAction<Action extends string>(
  generator: Generator<Action>,
  random: SeededRandom,
  state: unknown
): Action | null {
  // Use custom generator if provided
  if (generator.generate) {
    return generator.generate(random, state)
  }

  // Filter by preconditions
  const available = getAvailableActions(generator, state)

  // No available actions - return null to indicate stall
  if (available.length === 0) {
    return null
  }

  // Use weighted pick if weights provided
  if (generator.weights) {
    // Filter weights to only available actions
    const filteredWeights: Partial<Record<Action & string, number>> = {}
    for (const action of available) {
      if (generator.weights[action as keyof typeof generator.weights] !== undefined) {
        filteredWeights[action as Action & string] =
          generator.weights[action as keyof typeof generator.weights]
      }
    }
    return random.weightedPick(available, filteredWeights)
  }

  // Default to uniform pick
  return random.pick(available)
}
