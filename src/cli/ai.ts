/**
 * AI mode CLI runner
 *
 * Discovers .spec.ts files and runs AI-driven exploration on each.
 */

import type { CliOptions } from './index.js'
import { discoverSpecs, loadSpec } from './discover.js'
import { runAiExploration } from '../ai/harness.js'
import { generateTestCode } from '../ai/save.js'

export interface AiResult {
  file: string
  passed: boolean
  scenarioCount: number
  findings: number
  tokensUsed: number
  model: string
}

/**
 * Run AI exploration mode on discovered spec files
 */
export async function runAiMode(options: CliOptions): Promise<number> {
  const model = options.ai?.model ?? 'claude-sonnet'
  const focus = options.ai?.focus
  const scenarioCount = options.ai?.scenarioCount ?? 10
  const provider = options.ai?.provider ?? 'anthropic'

  console.log(`\n🤖 vitestx ai (model: ${model}, provider: ${provider}, scenarios: ${scenarioCount})`)
  if (focus && focus.length > 0) {
    console.log(`   Focus: ${focus.join(', ')}`)
  }
  console.log()

  // Discover spec files
  const specs = await discoverSpecs(options.files)

  if (specs.length === 0) {
    console.log('No spec files found. Files should export: surface, actions, invariants')
    return 1
  }

  const results: AiResult[] = []
  let totalFindings = 0

  for (const specPath of specs) {
    const spec = await loadSpec(specPath)

    if (!spec.surface || !spec.actions || !spec.invariants) {
      console.log(`⏭  ${specPath} (missing exports)`)
      continue
    }

    console.log(`🔍 ${specPath}`)

    const result = await runAiExploration(spec.surface, spec.actions, spec.invariants, {
      model,
      provider,
      scenarioCount,
      maxActionsPerScenario: spec.generator?.maxSteps ?? 20,
      focus,
      description: spec.description,
    })

    results.push({
      file: specPath,
      passed: result.passed,
      scenarioCount: result.scenarios.length,
      findings: result.findings.length,
      tokensUsed: result.tokensUsed,
      model: result.model,
    })

    if (result.passed) {
      console.log(`  ✓ ${result.scenarios.length} scenarios passed`)
    } else {
      console.log(`  ✗ ${result.findings.length} findings:`)

      for (const finding of result.findings) {
        console.log(`    - ${finding.scenario.name}`)
        console.log(`      Invariant: ${finding.failure?.invariant}`)
        console.log(`      Step: ${finding.failure?.step} (${finding.failure?.action})`)
        console.log(`      Message: ${finding.failure?.message}`)
      }

      // Show generated regression test code for first finding
      if (result.findings.length > 0 && result.findings[0].steps.length > 0) {
        console.log('\n  📝 Generated regression test:')
        const testCode = generateTestCode(
          result.findings[0].steps,
          specPath,
          `regression-${result.findings[0].scenario.name}`
        )
        // Indent the generated code
        console.log(testCode.split('\n').map((l) => `    ${l}`).join('\n'))
      }

      totalFindings += result.findings.length
    }

    if (result.tokensUsed > 0) {
      console.log(`  Tokens: ${result.tokensUsed}`)
    }
  }

  // Summary
  console.log(`\n📊 Results: ${specs.length} files, ${totalFindings} findings`)

  return totalFindings > 0 ? 1 : 0
}
