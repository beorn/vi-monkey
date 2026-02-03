/**
 * Doc mode CLI runner
 *
 * Runs mdtest on *.test.md files, providing Cram-style CLI testing.
 */

import type { CliOptions } from './index.js'

/**
 * Run doc mode (mdtest wrapper)
 *
 * This delegates to mdtest but integrates with vitestx's reporting.
 */
export async function runDocMode(options: CliOptions): Promise<number> {
  const pattern = options.doc?.pattern ?? '**/*.test.md'
  const files = options.files ?? []

  console.log(`\n📄 vitestx doc (pattern: ${pattern})\n`)

  // Try to import mdtest
  try {
    // mdtest should be installed as a peer dependency
    // For now, we delegate to the mdtest CLI
    const { execSync } = await import('child_process')

    const args = files.length > 0 ? files.join(' ') : pattern
    try {
      execSync(`bunx mdtest ${args}`, { stdio: 'inherit' })
      return 0
    } catch (error) {
      // mdtest returns non-zero on test failures
      return 1
    }
  } catch {
    console.log('mdtest not found. Install with: bun add @beorn/mdtest')
    console.log('Or run mdtest directly: bunx mdtest *.test.md')
    return 1
  }
}
