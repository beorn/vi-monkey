#!/usr/bin/env node
/**
 * vitestx CLI entry point
 *
 * @example
 * ```bash
 * vitestx fuzz board.spec.ts
 * vitestx ai board.spec.ts --focus "boundary conditions"
 * vitestx doc *.test.md
 * vitestx  # passes through to vitest
 * ```
 */

import { run, parseArgs } from './cli/index.js'

const args = process.argv.slice(2)

// Help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
vitestx - Vitest extension with fuzz and AI testing modes

Usage:
  vitestx fuzz [files...]     Run fuzz tests
  vitestx ai [files...]       Run AI exploration
  vitestx doc [files...]      Run mdtest on *.test.md
  vitestx [files...]          Pass through to vitest

Fuzz options:
  --seed <n>           Seed for reproducibility
  --iterations <n>     Number of iterations (default: 100)

AI options:
  --model <name>       LLM model (default: claude-sonnet)
  --focus <hint>       Focus on specific area (can repeat)
  --scenario-count <n> Number of scenarios (default: 10)

Doc options:
  --pattern <glob>     Pattern for test.md files

Examples:
  FUZZ_SEED=12345 vitestx fuzz
  vitestx ai --focus "empty state" --focus "rapid actions"
  vitestx doc docs/*.test.md
`)
  process.exit(0)
}

const { mode, options } = parseArgs(args)

run(mode, options).then((code) => process.exit(code))
