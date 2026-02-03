/**
 * Unified vitest plugin for vitestx
 *
 * @example
 * ```typescript
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config'
 * import { vitestx } from 'vitestx/plugin'
 *
 * export default defineConfig({
 *   plugins: [
 *     vitestx({
 *       fuzz: { iterations: 100 },
 *       ai: { model: 'claude-sonnet' },
 *       doc: { pattern: '**\/*.test.md' },
 *     })
 *   ]
 * })
 * ```
 */

import type { Plugin } from 'vite'

export interface VitestxFuzzOptions {
  /** Number of actions per test run (default: 100) */
  iterations?: number
  /** Seed source: 'env' reads FUZZ_SEED, 'random' generates new (default: 'env') */
  seed?: 'env' | 'random'
  /** Stop after first failure (default: true) */
  failFast?: boolean
  /** Shrinking settings */
  shrink?: {
    enabled?: boolean
    maxAttempts?: number
  }
}

export interface VitestxAiOptions {
  /** Model identifier (Vercel AI SDK format) */
  model?: string
  /** Temperature for LLM (0 = deterministic) */
  temperature?: number
  /** Maximum actions per exploration */
  maxSteps?: number
  /** Token budget per file */
  maxTokens?: number
  /** Directory to save discovered tests */
  saveDir?: string
  /** Use Claude Code provider */
  provider?: 'openai' | 'anthropic' | 'claude-code'
}

export interface VitestxDocOptions {
  /** Glob pattern for mdtest files */
  pattern?: string
}

export interface VitestxOptions {
  /** Fuzz mode configuration */
  fuzz?: VitestxFuzzOptions
  /** AI mode configuration */
  ai?: VitestxAiOptions
  /** Doc mode configuration (mdtest) */
  doc?: VitestxDocOptions
}

/**
 * Creates the vitestx plugin for Vitest
 */
export function vitestx(options: VitestxOptions = {}): Plugin {
  const {
    fuzz = {},
    ai = {},
    doc = {},
  } = options

  return {
    name: 'vitestx',

    config() {
      // Configure vitest for custom modes
      // Returns void for now - will be populated as modes are implemented
    },

    configureServer(server) {
      // Handle custom CLI modes: vitest fuzz, vitest ai, vitest doc
      // Implementation will intercept vitest CLI commands
    },
  }
}

export default vitestx
