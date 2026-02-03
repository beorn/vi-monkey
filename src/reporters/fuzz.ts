/**
 * Fuzz-specific test reporter
 *
 * Formats fuzz test results with seed, actions, and shrinking info.
 */

import type { FuzzRunResult } from '../fuzz/runner.js'
import type { ShrinkResult } from '../fuzz/shrink.js'

export interface FuzzReportOptions {
  verbose?: boolean
  showActions?: boolean
  maxActionsShown?: number
}

/**
 * Format a fuzz run result for display
 */
export function formatFuzzResult(
  result: FuzzRunResult,
  shrinkResult?: ShrinkResult,
  options: FuzzReportOptions = {}
): string {
  const { verbose = false, showActions = true, maxActionsShown = 20 } = options

  const lines: string[] = []

  if (result.passed) {
    lines.push(`✓ Passed (${result.steps} steps, seed: ${result.seed})`)
    return lines.join('\n')
  }

  // Failure case
  lines.push(`✗ FAILED`)
  lines.push('')
  lines.push(`  Invariant violated: ${result.failure!.invariant}`)
  lines.push(`  Message: ${result.failure!.message}`)
  lines.push(`  Step: ${result.failure!.step} of ${result.steps}`)
  lines.push(`  Seed: ${result.seed}`)
  lines.push('')

  if (showActions) {
    const actions = shrinkResult?.shrunk ?? result.actions
    const truncated = actions.length > maxActionsShown

    lines.push(`  Actions${shrinkResult ? ' (shrunk)' : ''}:`)

    const displayActions = truncated ? actions.slice(0, maxActionsShown) : actions
    for (let i = 0; i < displayActions.length; i++) {
      const marker = i === result.failure!.step - 1 ? ' ← failed here' : ''
      lines.push(`    ${i + 1}. ${displayActions[i]}${marker}`)
    }

    if (truncated) {
      lines.push(`    ... (${actions.length - maxActionsShown} more)`)
    }
    lines.push('')
  }

  if (shrinkResult) {
    lines.push(`  Shrinking:`)
    lines.push(`    Original: ${shrinkResult.original.length} actions`)
    lines.push(`    Shrunk: ${shrinkResult.shrunk.length} actions`)
    lines.push(`    Reduction: ${shrinkResult.reductionPercent}%`)
    lines.push(`    Attempts: ${shrinkResult.attempts}`)
    lines.push('')
  }

  lines.push(`  Reproduce:`)
  lines.push(`    FUZZ_SEED=${result.seed} vitest fuzz <file>`)

  if (verbose && result.failure?.state) {
    lines.push('')
    lines.push(`  State at failure:`)
    lines.push(`    ${JSON.stringify(result.failure.state, null, 2).replace(/\n/g, '\n    ')}`)
  }

  return lines.join('\n')
}

/**
 * Format summary of multiple fuzz runs
 */
export function formatFuzzSummary(results: {
  passed: boolean
  iterations: number
  failures: FuzzRunResult[]
}): string {
  const lines: string[] = []

  if (results.passed) {
    lines.push(`✓ All ${results.iterations} iterations passed`)
  } else {
    lines.push(`✗ ${results.failures.length} failures in ${results.iterations} iterations`)
    lines.push('')

    for (const failure of results.failures) {
      lines.push(`  Seed ${failure.seed}: ${failure.failure!.invariant} at step ${failure.failure!.step}`)
    }
  }

  return lines.join('\n')
}
