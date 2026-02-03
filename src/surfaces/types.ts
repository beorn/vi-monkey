/**
 * Surface abstraction for testing
 *
 * A Surface is the unified interface for the thing under test.
 * Whether testing a TUI, CLI, or API, you interact through the same interface.
 */

/**
 * Element returned by query operations
 */
export interface Element {
  /** Element tag/type */
  type: string
  /** Element attributes/props */
  props: Record<string, unknown>
  /** Child elements */
  children: Element[]
  /** Dataset (data-* attributes) */
  dataset: Record<string, string>
  /** Text content */
  textContent: string
}

/**
 * Surface interface for testing any system
 *
 * @typeParam State - The state type returned by getState
 * @typeParam Action - The action type accepted by sendAction
 * @typeParam Instance - The instance type created by create (internal)
 */
export interface Surface<State, Action, Instance = unknown> {
  /**
   * Create a new instance of the thing under test
   */
  create(): Instance

  /**
   * Send an action to the instance
   */
  sendAction(instance: Instance, action: Action): void | Promise<void>

  /**
   * Get the current state
   */
  getState(instance: Instance): State

  /**
   * Query elements (for UI testing)
   * Returns empty array if not applicable
   */
  query(instance: Instance, selector: string): Element[]

  /**
   * Cleanup resources
   */
  dispose?(instance: Instance): void | Promise<void>
}

/**
 * Configuration for defineSurface
 */
export interface SurfaceConfig<State, Action, Instance> {
  /** Create a new instance */
  create: () => Instance
  /** Send an action */
  sendAction: (instance: Instance, action: Action) => void | Promise<void>
  /** Get current state */
  getState: (instance: Instance) => State
  /** Query elements (optional) */
  query?: (instance: Instance, selector: string) => Element[]
  /** Cleanup (optional) */
  dispose?: (instance: Instance) => void | Promise<void>
}

/**
 * Define a surface for testing
 *
 * @example
 * ```typescript
 * const surface = defineSurface({
 *   create: () => renderBoard(SAMPLE_DATA),
 *   sendAction: (board, key) => board.press(key),
 *   getState: (board) => board.getState(),
 *   query: (board, sel) => board.queryAll(sel),
 * })
 * ```
 */
export function defineSurface<State, Action, Instance>(
  config: SurfaceConfig<State, Action, Instance>
): Surface<State, Action, Instance> {
  return {
    create: config.create,
    sendAction: config.sendAction,
    getState: config.getState,
    query: config.query ?? (() => []),
    dispose: config.dispose,
  }
}
