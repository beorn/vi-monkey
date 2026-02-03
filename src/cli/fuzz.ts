/**
 * Fuzz mode CLI runner
 *
 * Discovers .spec.ts files with surface/generator/invariants exports,
 * runs fuzz tests on each.
 */

import type { CliOptions } from './index.js'
import { discoverSpecs, loadSpec, type SpecModule } from './discover.js'
import { runFuzz } from '../fuzz/runner.js'
import { shrinkSequence } from '../fuzz/shrink.js'
import { parseSeed } from '../random.js'

export interface FuzzResult {
  file: string
  passed: boolean
  iterations: number
  seed: number
  failure?: {
    step: number
    action: string
    invariant: string
    message: string
  }
  shrunk?: string[]
}

/**
 * Run fuzz mode on discovered spec files
 */
export async function runFuzzMode(options: CliOptions): Promise<number> {
  const seed = options.fuzz?.seed ?? parseSeed('env')
  const iterations = options.fuzz?.iterations ?? 100

  console.log(`\n🎲 vitestx fuzz (seed: ${seed}, iterations: ${iterations})\n`)

  // Discover spec files
  const specs = await discoverSpecs(options.files)

  if (specs.length === 0) {
    console.log('No spec files found. Files should export: surface, generator, invariants')
    return 1
  }

  const results: FuzzResult[] = []
  let passed = 0
  let failed = 0

  for (const specPath of specs) {
    const spec = await loadSpec(specPath)

    if (!spec.surface || !spec.generator || !spec.invariants) {
      console.log(`⏭  ${specPath} (missing exports)`)
      continue
    }

    console.log(`🔄 ${specPath}`)

    // Run multiple iterations
    for (let i = 0; i < iterations; i++) {
      const iterSeed = seed + i

      const result = await runFuzz(spec.surface, spec.generator, spec.invariants, {
        seed: iterSeed,
        maxSteps: spec.generator.maxSteps,
      })

      if (!result.passed) {
        // Shrink the failure
        let shrunk: string[] | undefined
        if (result.actions.length > 0 && result.failure) {
          const shrinkResult = await shrinkSequence(
            spec.surface,
            spec.invariants,
            result.actions,
            result.failure.invariant,
            { maxAttempts: 100 }
          )
          shrunk = shrinkResult.shrunk
        }

        results.push({
          file: specPath,
          passed: false,
          iterations: i + 1,
          seed: iterSeed,
          failure: result.failure,
          shrunk,
        })

        failed++
        console.log(`  ✗ Failed at iteration ${i + 1} (seed: ${iterSeed})`)
        console.log(`    Invariant: ${result.failure?.invariant}`)
        console.log(`    Message: ${result.failure?.message}`)
        console.log(`    Actions: ${result.actions.length}`)
        if (shrunk) {
          console.log(`    Shrunk: ${shrunk.length} actions`)
          console.log(`    Reproduce: FUZZ_SEED=${iterSeed} vitestx fuzz ${specPath}`)
        }

        // Stop on first failure for this file
        break
      }
    }

    if (!results.some((r) => r.file === specPath && !r.passed)) {
      results.push({
        file: specPath,
        passed: true,
        iterations,
        seed,
      })
      passed++
      console.log(`  ✓ ${iterations} iterations passed`)
    }
  }

  // Summary
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

  return failed > 0 ? 1 : 0
}
