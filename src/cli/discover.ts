/**
 * Spec file discovery and loading
 *
 * Finds *.spec.ts files and dynamically imports them to access
 * surface, generator, invariants, and actions exports.
 */

import { glob } from 'glob'
import type { Surface } from '../surfaces/types.js'
import type { Generator } from '../fuzz/generator.js'
import type { Invariants } from '../invariants/dsl.js'

/**
 * A loaded spec module
 */
export interface SpecModule {
  /** Surface definition */
  surface?: Surface<unknown, string, unknown>
  /** Generator for fuzz mode */
  generator?: Generator<string>
  /** Invariants to check */
  invariants?: Invariants<unknown>
  /** Available actions (for AI mode) */
  actions?: readonly string[]
  /** System description (for AI mode) */
  description?: string
}

/**
 * Discover spec files matching patterns
 */
export async function discoverSpecs(patterns?: string[]): Promise<string[]> {
  const searchPatterns = patterns && patterns.length > 0 ? patterns : ['**/*.spec.ts']

  const files: string[] = []

  for (const pattern of searchPatterns) {
    // If pattern is a direct file path, use it
    if (pattern.endsWith('.ts') && !pattern.includes('*')) {
      files.push(pattern)
    } else {
      // Use glob for patterns
      const matches = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**'],
        cwd: process.cwd(),
        absolute: true,
      })
      files.push(...matches)
    }
  }

  return [...new Set(files)] // Dedupe
}

/**
 * Load a spec file and extract exports
 */
export async function loadSpec(specPath: string): Promise<SpecModule> {
  try {
    // Dynamic import of the spec file
    const module = await import(specPath)

    return {
      surface: module.surface,
      generator: module.generator,
      invariants: module.invariants,
      actions: module.actions,
      description: module.description,
    }
  } catch (error) {
    console.error(`Failed to load spec: ${specPath}`)
    console.error(error)
    return {}
  }
}
