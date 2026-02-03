/**
 * Fuzz mode for vitest
 *
 * Implements `vitest fuzz` command.
 */

// TODO: Implement fuzz mode integration with vitest CLI
// This will intercept `vitest fuzz` and run fuzz tests

export interface FuzzModeOptions {
  iterations: number
  seed: number | 'random'
  failFast: boolean
  shrink: {
    enabled: boolean
    maxAttempts: number
  }
}

export const defaultFuzzOptions: FuzzModeOptions = {
  iterations: 100,
  seed: 'random',
  failFast: true,
  shrink: {
    enabled: true,
    maxAttempts: 100,
  },
}
