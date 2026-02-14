/**
 * Fuzz test context using AsyncLocalStorage for auto-tracking
 *
 * When running inside test.fuzz(), take() automatically records
 * yielded values for shrinking and regression testing.
 */
import { AsyncLocalStorage } from "node:async_hooks"

export interface FuzzContext {
  /** Recorded history of yielded values */
  history: unknown[]
  /** If replaying, the sequence to replay */
  replaySequence: unknown[] | null
  /** Current index in replay sequence */
  replayIndex: number
  /** The seed used for this test run */
  seed: number
}

/** AsyncLocalStorage for fuzz test context */
export const fuzzContext = new AsyncLocalStorage<FuzzContext>()

/**
 * Create a new fuzz context
 */
export function createFuzzContext(seed: number): FuzzContext {
  return {
    history: [],
    replaySequence: null,
    replayIndex: 0,
    seed,
  }
}

/**
 * Create a replay context from a saved sequence
 */
export function createReplayContext(sequence: unknown[], seed: number): FuzzContext {
  return {
    history: [],
    replaySequence: sequence,
    replayIndex: 0,
    seed,
  }
}

/**
 * Check if we're currently in a fuzz context
 */
export function isInFuzzContext(): boolean {
  return fuzzContext.getStore() !== undefined
}

/**
 * Get the current fuzz context or undefined
 */
export function getFuzzContext(): FuzzContext | undefined {
  return fuzzContext.getStore()
}
