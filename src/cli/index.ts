/**
 * CLI entry point for vitestx
 *
 * Provides custom commands that wrap vitest:
 * - vitestx fuzz [files...]
 * - vitestx ai [files...]
 * - vitestx doc [files...]
 * - vitestx (passes through to vitest)
 *
 * @example
 * ```bash
 * # Run fuzz tests
 * vitestx fuzz board.spec.ts
 *
 * # Run AI exploration
 * vitestx ai board.spec.ts --focus "boundary conditions"
 *
 * # Run mdtest files
 * vitestx doc *.test.md
 * ```
 */

import { runFuzzMode } from './fuzz.js'
import { runAiMode } from './ai.js'
import { runDocMode } from './doc.js'

export interface CliOptions {
  /** Files to test */
  files?: string[]
  /** Fuzz mode options */
  fuzz?: {
    seed?: number
    iterations?: number
  }
  /** AI mode options */
  ai?: {
    model?: string
    focus?: string[]
    scenarioCount?: number
    provider?: 'anthropic' | 'openai' | 'claude-code'
  }
  /** Doc mode options */
  doc?: {
    pattern?: string
  }
}

/**
 * Run vitestx CLI
 */
export async function run(
  mode: 'fuzz' | 'ai' | 'doc' | 'test',
  options: CliOptions = {}
): Promise<number> {
  switch (mode) {
    case 'fuzz':
      return runFuzzMode(options)
    case 'ai':
      return runAiMode(options)
    case 'doc':
      return runDocMode(options)
    case 'test':
      // Pass through to vitest
      const { execSync } = await import('child_process')
      try {
        execSync('vitest ' + (options.files?.join(' ') || ''), { stdio: 'inherit' })
        return 0
      } catch {
        return 1
      }
  }
}

/**
 * Parse CLI arguments
 */
export function parseArgs(args: string[]): { mode: 'fuzz' | 'ai' | 'doc' | 'test'; options: CliOptions } {
  const mode = args[0] as 'fuzz' | 'ai' | 'doc' | 'test' ?? 'test'
  const options: CliOptions = { files: [] }

  // Options that take a value (skip their argument)
  const optionsWithValue = new Set([
    '--seed',
    '--iterations',
    '--model',
    '--focus',
    '--scenario-count',
    '--pattern',
    '--provider',
  ])

  // Parse flags and collect files
  let i = 1
  while (i < args.length) {
    const arg = args[i]

    if (arg === '--seed' && args[i + 1]) {
      options.fuzz = { ...options.fuzz, seed: parseInt(args[++i]) }
    } else if (arg === '--iterations' && args[i + 1]) {
      options.fuzz = { ...options.fuzz, iterations: parseInt(args[++i]) }
    } else if (arg === '--model' && args[i + 1]) {
      options.ai = { ...options.ai, model: args[++i] }
    } else if (arg === '--focus' && args[i + 1]) {
      options.ai = { ...options.ai, focus: [...(options.ai?.focus || []), args[++i]] }
    } else if (arg === '--scenario-count' && args[i + 1]) {
      options.ai = { ...options.ai, scenarioCount: parseInt(args[++i]) }
    } else if (arg === '--provider' && args[i + 1]) {
      const provider = args[++i] as 'anthropic' | 'openai' | 'claude-code'
      options.ai = { ...options.ai, provider }
    } else if (arg === '--pattern' && args[i + 1]) {
      options.doc = { ...options.doc, pattern: args[++i] }
    } else if (!arg.startsWith('--')) {
      // Not an option, must be a file
      options.files!.push(arg)
    }

    i++
  }

  return {
    mode: ['fuzz', 'ai', 'doc'].includes(mode) ? (mode as 'fuzz' | 'ai' | 'doc') : 'test',
    options,
  }
}
