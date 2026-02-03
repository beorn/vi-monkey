/**
 * Shrinking algorithm for fuzz tests
 *
 * Finds minimal action sequence that reproduces a failure.
 */

import type { Surface } from '../surfaces/types.js'
import type { Invariants } from '../invariants/dsl.js'
import { checkInvariants } from '../invariants/dsl.js'

export interface ShrinkResult {
  original: string[]
  shrunk: string[]
  reductionPercent: number
  attempts: number
}

export interface ShrinkOptions {
  maxAttempts?: number
  onAttempt?: (attempt: number, sequence: string[], passed: boolean) => void
}

/**
 * Shrink a failing action sequence to minimal reproduction
 *
 * Uses binary search and deletion strategies.
 */
export async function shrinkSequence<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  invariants: Invariants<State>,
  failingActions: string[],
  failedInvariant: string,
  options: ShrinkOptions = {}
): Promise<ShrinkResult> {
  const maxAttempts = options.maxAttempts ?? 100
  let attempts = 0
  let current = [...failingActions]

  // Helper to check if sequence still fails
  async function stillFails(sequence: string[]): Promise<boolean> {
    if (attempts >= maxAttempts) return false
    attempts++

    const instance = surface.create()
    try {
      for (const action of sequence) {
        await surface.sendAction(instance, action as Action)
      }
      const state = surface.getState(instance)
      const check = checkInvariants(invariants, state)
      const failed = !check.passed && check.firstFailure?.name === failedInvariant

      options.onAttempt?.(attempts, sequence, !failed)
      return failed
    } finally {
      await surface.dispose?.(instance)
    }
  }

  // Strategy 1: Binary search on length
  let low = 0
  let high = current.length

  while (low < high && attempts < maxAttempts) {
    const mid = Math.floor((low + high) / 2)
    const prefix = current.slice(0, mid)

    if (await stillFails(prefix)) {
      current = prefix
      high = mid
    } else {
      low = mid + 1
    }
  }

  // Strategy 2: Try removing individual actions
  let i = 0
  while (i < current.length && attempts < maxAttempts) {
    const without = [...current.slice(0, i), ...current.slice(i + 1)]
    if (await stillFails(without)) {
      current = without
      // Don't increment i, try removing from same position
    } else {
      i++
    }
  }

  return {
    original: failingActions,
    shrunk: current,
    reductionPercent: Math.round((1 - current.length / failingActions.length) * 100),
    attempts,
  }
}
