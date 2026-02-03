/**
 * Invariant DSL for property checking
 *
 * Invariants are properties that must hold after every action.
 */

/**
 * Result of an invariant check
 * - true: invariant holds
 * - false: invariant violated (generic message)
 * - string: invariant violated (custom message)
 */
export type InvariantResult = boolean | string

/**
 * Invariant function type
 *
 * @typeParam State - The state type to check
 */
export type Invariant<State> = (state: State) => InvariantResult

/**
 * Collection of named invariants
 */
export type Invariants<State> = Record<string, Invariant<State>>

/**
 * Result of checking all invariants
 */
export interface InvariantCheckResult {
  /** Whether all invariants passed */
  passed: boolean
  /** Results for each invariant */
  results: Record<string, { passed: boolean; message?: string }>
  /** First failure (if any) */
  firstFailure?: { name: string; message: string }
}

/**
 * Define invariants for testing
 *
 * @example
 * ```typescript
 * const invariants = defineInvariants({
 *   // Boolean return: true = pass, false = fail
 *   singleCursor: (state) =>
 *     state.queryAll('[data-cursor]').length === 1,
 *
 *   // String return for custom error message
 *   validRange: (state) => {
 *     if (state.value < 0) return `Value ${state.value} is negative`
 *     if (state.value > 100) return `Value ${state.value} exceeds max`
 *     return true
 *   },
 *
 *   // Complex invariants
 *   noOrphanNodes: (state) => {
 *     for (const node of state.nodes) {
 *       if (node.parentId && !state.nodeMap.has(node.parentId)) {
 *         return `Node ${node.id} has orphan parent ${node.parentId}`
 *       }
 *     }
 *     return true
 *   },
 * })
 * ```
 */
export function defineInvariants<State>(
  invariants: Invariants<State>
): Invariants<State> {
  return invariants
}

/**
 * Check all invariants against a state
 *
 * @internal
 */
export function checkInvariants<State>(
  invariants: Invariants<State>,
  state: State
): InvariantCheckResult {
  const results: Record<string, { passed: boolean; message?: string }> = {}
  let firstFailure: { name: string; message: string } | undefined

  for (const [name, check] of Object.entries(invariants)) {
    try {
      const result = check(state)

      if (result === true) {
        results[name] = { passed: true }
      } else if (result === false) {
        results[name] = { passed: false, message: `Invariant "${name}" violated` }
        if (!firstFailure) {
          firstFailure = { name, message: results[name].message! }
        }
      } else {
        // String result = custom error message
        results[name] = { passed: false, message: result }
        if (!firstFailure) {
          firstFailure = { name, message: result }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results[name] = { passed: false, message: `Invariant "${name}" threw: ${message}` }
      if (!firstFailure) {
        firstFailure = { name, message: results[name].message! }
      }
    }
  }

  return {
    passed: !firstFailure,
    results,
    firstFailure,
  }
}
