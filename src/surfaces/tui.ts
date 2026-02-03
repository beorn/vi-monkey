/**
 * TUI surface adapter
 *
 * Provides inkx-compatible surface for TUI testing.
 */

import type { Surface, Element, SurfaceConfig } from './types.js'

/**
 * TUI-specific surface configuration
 *
 * Extends the base surface with TUI-specific helpers.
 */
export interface TuiSurfaceConfig<State, Instance> extends SurfaceConfig<State, string, Instance> {
  /** Press a key (alias for sendAction) */
  press?: (instance: Instance, key: string) => void | Promise<void>
}

/**
 * Create a TUI surface with keyboard input
 *
 * @example
 * ```typescript
 * import { createTuiSurface } from 'vitestx'
 * import { render } from 'inkx/testing'
 * import { Board } from './board'
 *
 * export const surface = createTuiSurface({
 *   create: () => render(<Board />),
 *   press: (board, key) => board.press(key),
 *   getState: (board) => board.getState(),
 *   query: (board, sel) => board.queryAll(sel),
 * })
 * ```
 */
export function createTuiSurface<State, Instance>(
  config: TuiSurfaceConfig<State, Instance>
): Surface<State, string, Instance> {
  return {
    create: config.create,
    sendAction: config.press ?? config.sendAction,
    getState: config.getState,
    query: config.query ?? (() => []),
    dispose: config.dispose,
  }
}

/**
 * Common key mappings for TUI testing
 */
export const Keys = {
  // Navigation
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',

  // Vim-style
  j: 'j',
  k: 'k',
  h: 'h',
  l: 'l',

  // Actions
  enter: '\r',
  escape: '\x1b',
  space: ' ',
  tab: '\t',
  backspace: '\x7f',

  // Control keys
  ctrlC: '\x03',
  ctrlD: '\x04',
  ctrlZ: '\x1a',
} as const
