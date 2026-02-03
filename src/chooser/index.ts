/**
 * Unified ActionChooser interface
 *
 * Abstracts over different action selection strategies:
 * - Random: weighted random selection (fuzz mode)
 * - AI: LLM-based selection (ai mode)
 * - Manual: user-specified sequence (replay mode)
 *
 * This allows running tests with different choosers without changing test logic.
 */

import type { SeededRandom } from '../random.js'
import type { Generator } from '../fuzz/generator.js'
import { generateAction, getAvailableActions } from '../fuzz/generator.js'

/**
 * ActionChooser selects the next action based on current state
 */
export interface ActionChooser<Action> {
  /** Name of the chooser strategy */
  name: string

  /**
   * Choose the next action given current state
   * Returns null if no action can be chosen (stall)
   */
  choose(state: unknown): Action | null | Promise<Action | null>

  /** Reset the chooser for a new run (if stateful) */
  reset?(): void
}

/**
 * Create a random action chooser using a generator
 */
export function createRandomChooser<Action extends string>(
  generator: Generator<Action>,
  random: SeededRandom
): ActionChooser<Action> {
  return {
    name: 'random',
    choose(state) {
      return generateAction(generator, random, state)
    },
  }
}

/**
 * Create a manual/replay chooser that plays a fixed sequence
 */
export function createReplayChooser<Action>(actions: Action[]): ActionChooser<Action> {
  let index = 0

  return {
    name: 'replay',
    choose() {
      if (index >= actions.length) return null
      return actions[index++]
    },
    reset() {
      index = 0
    },
  }
}

/**
 * Create an AI chooser that uses LLM to select actions
 * (Placeholder - real implementation would call LLM API)
 */
export interface AiChooserOptions {
  model: string
  temperature: number
  availableActions: readonly string[]
  systemPrompt?: string
}

export function createAiChooser<Action extends string>(
  options: AiChooserOptions
): ActionChooser<Action> {
  // For now, returns a stub that cycles through actions
  // Real implementation would call LLM API with state context
  let index = 0

  return {
    name: `ai:${options.model}`,
    async choose(state) {
      // TODO: Call LLM with state context
      // For now, cycle through available actions
      if (options.availableActions.length === 0) return null
      const action = options.availableActions[index % options.availableActions.length] as Action
      index++
      return action
    },
    reset() {
      index = 0
    },
  }
}

/**
 * Run a test using any ActionChooser
 */
export interface ChooserRunOptions<Action> {
  chooser: ActionChooser<Action>
  maxSteps: number
  onStep?: (step: number, action: Action, state: unknown) => void
}

export interface ChooserRunResult<Action> {
  actions: Action[]
  steps: number
  stalled: boolean
}

import type { Surface } from '../surfaces/types.js'

/**
 * Execute actions using a chooser
 */
export async function runWithChooser<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  options: ChooserRunOptions<Action>
): Promise<ChooserRunResult<Action>> {
  const { chooser, maxSteps, onStep } = options
  const instance = surface.create()
  const actions: Action[] = []

  try {
    let state = surface.getState(instance)

    for (let step = 1; step <= maxSteps; step++) {
      const action = await chooser.choose(state)

      if (action === null) {
        // Stalled - no action available
        return { actions, steps: step - 1, stalled: true }
      }

      actions.push(action)
      onStep?.(step, action, state)

      await surface.sendAction(instance, action)
      state = surface.getState(instance)
    }

    return { actions, steps: maxSteps, stalled: false }
  } finally {
    await surface.dispose?.(instance)
  }
}
