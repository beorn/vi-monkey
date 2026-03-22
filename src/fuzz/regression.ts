/**
 * Regression testing - save and load failing sequences
 *
 * Failing fuzz test sequences are saved to __fuzz_cases__/ directory
 * like Jest/Vitest snapshots. On subsequent runs, saved sequences
 * are replayed first to ensure bugs don't regress.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs"
import { dirname, join, basename } from "node:path"

/** Failure case saved to disk */
export interface SavedCase {
  /** Test name */
  test: string
  /** Seed used for generation */
  seed: number
  /** Minimal failing sequence */
  sequence: unknown[]
  /** Error message */
  error: string
  /** When the failure was recorded */
  timestamp: string
  /** Original sequence length before shrinking */
  originalLength?: number
}

/**
 * Get the __fuzz_cases__ directory path for a test file
 */
export function getFuzzCasesDir(testFilePath: string): string {
  const dir = dirname(testFilePath)
  const file = basename(testFilePath)
  return join(dir, "__fuzz_cases__", file)
}

/**
 * Generate a filename for a saved case
 */
function getCaseFilename(testName: string): string {
  // Sanitize test name for filesystem
  const safe = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
  const timestamp = Date.now()
  return `${safe}-${timestamp}.json`
}

/**
 * Save a failing case to __fuzz_cases__/
 */
export function saveCase(testFilePath: string, testName: string, failure: SavedCase): string {
  const dir = getFuzzCasesDir(testFilePath)
  mkdirSync(dir, { recursive: true })

  const filename = getCaseFilename(testName)
  const filepath = join(dir, filename)

  writeFileSync(filepath, JSON.stringify(failure, null, 2))
  return filepath
}

/**
 * Load all saved cases for a test file
 */
export function loadCases(testFilePath: string): SavedCase[] {
  const dir = getFuzzCasesDir(testFilePath)
  if (!existsSync(dir)) return []

  const cases: SavedCase[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue
    try {
      const content = readFileSync(join(dir, file), "utf-8")
      cases.push(JSON.parse(content) as SavedCase)
    } catch {
      // Skip invalid files
    }
  }
  return cases
}

/**
 * Load saved cases for a specific test name
 */
export function loadCasesForTest(testFilePath: string, testName: string): SavedCase[] {
  return loadCases(testFilePath).filter((c) => c.test === testName)
}

/**
 * Delete a saved case (when bug is fixed)
 */
export function deleteCase(testFilePath: string, filename: string): void {
  const dir = getFuzzCasesDir(testFilePath)
  const filepath = join(dir, filename)
  if (existsSync(filepath)) {
    unlinkSync(filepath)
  }
}

/**
 * Clear all saved cases for a test file
 */
export function clearCases(testFilePath: string): void {
  const dir = getFuzzCasesDir(testFilePath)
  if (!existsSync(dir)) return

  for (const file of readdirSync(dir)) {
    if (file.endsWith(".json")) {
      unlinkSync(join(dir, file))
    }
  }
}
