/**
 * CLI surface adapter
 *
 * Provides surface for CLI command testing.
 */

import type { Surface, SurfaceConfig } from './types.js'

/**
 * Standard CLI state
 */
export interface CliState {
  args: string[]
  env: Record<string, string>
  cwd: string
  stdin: string
  stdout: string
  stderr: string
  exitCode: number | null
}

/**
 * CLI action types
 */
export type CliAction =
  | { type: 'arg'; value: string }
  | { type: 'env'; key: string; value: string }
  | { type: 'cwd'; path: string }
  | { type: 'stdin'; value: string }
  | { type: 'run' }

/**
 * Create a CLI surface
 *
 * @example
 * ```typescript
 * import { createCliSurface } from 'vitestx'
 *
 * export const surface = createCliSurface({
 *   command: 'mycommand',
 *   execute: (state) => {
 *     // Run command and update state
 *   },
 * })
 * ```
 */
export function createCliSurface(config: {
  command: string
  execute: (state: CliState) => void | Promise<void>
  initialEnv?: Record<string, string>
  initialCwd?: string
}): Surface<CliState, CliAction, CliState> {
  return {
    create: () => ({
      args: [],
      env: { ...config.initialEnv },
      cwd: config.initialCwd ?? process.cwd(),
      stdin: '',
      stdout: '',
      stderr: '',
      exitCode: null,
    }),

    sendAction: async (state, action) => {
      switch (action.type) {
        case 'arg':
          state.args.push(action.value)
          break
        case 'env':
          state.env[action.key] = action.value
          break
        case 'cwd':
          state.cwd = action.path
          break
        case 'stdin':
          state.stdin = action.value
          break
        case 'run':
          await config.execute(state)
          break
      }
    },

    getState: (state) => ({ ...state }),

    query: () => [],
  }
}
