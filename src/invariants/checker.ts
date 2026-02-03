/**
 * Runtime invariant checker
 *
 * Provides utilities for checking invariants at runtime.
 */

import type { Invariants, InvariantCheckResult } from './dsl.js'
import { checkInvariants } from './dsl.js'

export interface InvariantCheckerOptions {
  /** Throw on first failure instead of collecting all */
  throwOnFailure?: boolean
}

/**
 * Invariant violation error
 */
export class InvariantViolationError extends Error {
  constructor(
    public readonly invariantName: string,
    message: string,
    public readonly state?: unknown
  ) {
    super(`Invariant "${invariantName}" violated: ${message}`)
    this.name = 'InvariantViolationError'
  }
}

/**
 * Create a checker function for a set of invariants
 *
 * @example
 * ```typescript
 * const check = createChecker(invariants)
 *
 * // Returns result object
 * const result = check(state)
 * if (!result.passed) {
 *   console.log(result.firstFailure)
 * }
 *
 * // Or with throwOnFailure
 * const checkStrict = createChecker(invariants, { throwOnFailure: true })
 * checkStrict(state) // throws if any invariant fails
 * ```
 */
export function createChecker<State>(
  invariants: Invariants<State>,
  options: InvariantCheckerOptions = {}
): (state: State) => InvariantCheckResult {
  const { throwOnFailure = false } = options

  return (state: State) => {
    const result = checkInvariants(invariants, state)

    if (!result.passed && throwOnFailure) {
      const { name, message } = result.firstFailure!
      throw new InvariantViolationError(name, message, state)
    }

    return result
  }
}

/**
 * Assert all invariants pass, throwing on failure
 */
export function assertInvariants<State>(
  invariants: Invariants<State>,
  state: State,
  context?: string
): void {
  const result = checkInvariants(invariants, state)

  if (!result.passed) {
    const { name, message } = result.firstFailure!
    const contextStr = context ? ` (${context})` : ''
    throw new InvariantViolationError(name, `${message}${contextStr}`, state)
  }
}
