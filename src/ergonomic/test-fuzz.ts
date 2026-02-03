/**
 * test.fuzz wrapper with auto-tracking, shrinking, and regression
 *
 * Usage:
 * ```typescript
 * import { test } from '@beorn/vitestx/ergonomic'
 *
 * test.fuzz('cursor invariants', async () => {
 *   const handle = await run(<Board />, { cols: 80, rows: 24 })
 *   for await (const key of take(gen(['j','k','h','l']), 100)) {
 *     await handle.press(key)
 *     expect(handle.locator('[data-cursor]').count()).toBe(1)
 *   }
 * })
 * ```
 */

import { test as vitestTest, type TestOptions } from 'vitest'
import { fuzzContext, createFuzzContext, createReplayContext, type FuzzContext } from './context.js'
import { shrinkSequence, formatShrinkResult } from './shrink.js'
import { saveCase, loadCasesForTest, type SavedCase } from './regression.js'
import { parseSeed } from '../random.js'

/** Options for test.fuzz */
export interface FuzzTestOptions extends TestOptions {
	/** Seed for reproducibility (default: from FUZZ_SEED env or random) */
	seed?: number
	/** Whether to shrink failing sequences (default: true) */
	shrink?: boolean
	/** Whether to save failing sequences to __fuzz_cases__/ (default: true) */
	save?: boolean
	/** Whether to replay saved failing sequences first (default: true) */
	replay?: boolean
	/** Maximum shrinking attempts (default: 100) */
	maxShrinkAttempts?: number
}

/** Error with fuzz context attached */
export class FuzzError extends Error {
	readonly sequence: unknown[]
	readonly shrunk: unknown[]
	readonly seed: number
	readonly originalError: Error

	constructor(
		originalError: Error,
		info: {
			original: number
			shrunk: number
			sequence: unknown[]
			seed: number
		}
	) {
		const msg = `Fuzz test failed after ${info.original} steps (shrunk to ${info.shrunk})
Minimal failing sequence: ${JSON.stringify(info.sequence)}
Seed: ${info.seed} (reproduce with FUZZ_SEED=${info.seed})

Original error: ${originalError.message}`

		super(msg)
		this.name = 'FuzzError'
		this.sequence = info.sequence
		this.shrunk = info.sequence
		this.seed = info.seed
		this.originalError = originalError
	}
}

/**
 * Get the test file path from error stack
 * This is a heuristic - it looks for .test.ts or .fuzz.test.ts files
 */
function getTestFilePath(): string {
	const err = new Error()
	const stack = err.stack?.split('\n') ?? []

	for (const line of stack) {
		// Look for test file patterns
		const match = line.match(/\(([^)]+\.(test|fuzz\.test)\.(ts|tsx|js|jsx)):\d+:\d+\)/)
		if (match) return match[1]

		// Also try without parentheses
		const match2 = line.match(/at\s+([^\s]+\.(test|fuzz\.test)\.(ts|tsx|js|jsx)):\d+:\d+/)
		if (match2) return match2[1]
	}

	// Fallback to current working directory
	return process.cwd() + '/unknown.test.ts'
}

/**
 * Create the test.fuzz wrapper
 */
function createFuzzTest(
	name: string,
	fn: () => Promise<void>,
	options: FuzzTestOptions = {}
) {
	const {
		seed = parseSeed('env'),
		shrink = true,
		save = true,
		replay = true,
		maxShrinkAttempts = 100,
		...testOptions
	} = options

	// Vitest 4: options as second arg, function as third
	return vitestTest(name, testOptions, async () => {
		const testFilePath = getTestFilePath()

		// Replay saved failing sequences first
		if (replay) {
			const savedCases = loadCasesForTest(testFilePath, name)
			for (const savedCase of savedCases) {
				const replayCtx = createReplayContext(savedCase.sequence, savedCase.seed)
				try {
					await fuzzContext.run(replayCtx, fn)
					// If replay passes, the bug might be fixed - but we still run the main test
				} catch (error) {
					// Replay still fails - throw with saved context
					throw new FuzzError(error as Error, {
						original: savedCase.originalLength ?? savedCase.sequence.length,
						shrunk: savedCase.sequence.length,
						sequence: savedCase.sequence,
						seed: savedCase.seed,
					})
				}
			}
		}

		// Run the main fuzz test
		const ctx = createFuzzContext(seed)

		try {
			await fuzzContext.run(ctx, fn)
		} catch (error) {
			// Test failed - attempt shrinking
			if (ctx.history.length > 0) {
				let minimalSequence = ctx.history
				let shrinkResult

				if (shrink) {
					// Define the test runner for shrinking
					const runWithSequence = async (seq: unknown[]) => {
						const replayCtx = createReplayContext(seq, seed)
						try {
							await fuzzContext.run(replayCtx, fn)
							return true // passed
						} catch {
							return false // still fails
						}
					}

					shrinkResult = await shrinkSequence(ctx.history, runWithSequence, {
						maxAttempts: maxShrinkAttempts,
					})
					minimalSequence = shrinkResult.shrunk

					// Log shrink result
					console.log(formatShrinkResult(shrinkResult))
				}

				// Save failing case
				if (save) {
					const savedCase: SavedCase = {
						test: name,
						seed,
						sequence: minimalSequence,
						error: String(error),
						timestamp: new Date().toISOString(),
						originalLength: ctx.history.length,
					}
					const filepath = saveCase(testFilePath, name, savedCase)
					console.log(`Saved failing case to: ${filepath}`)
				}

				throw new FuzzError(error as Error, {
					original: ctx.history.length,
					shrunk: minimalSequence.length,
					sequence: minimalSequence,
					seed,
				})
			}

			throw error
		}
	})
}

// Type for the fuzz function
type FuzzFn = {
	(name: string, fn: () => Promise<void>, options?: FuzzTestOptions): void
	(name: string, options: FuzzTestOptions, fn: () => Promise<void>): void
}

// Create the fuzz function with overloads
const fuzz: FuzzFn = (
	name: string,
	fnOrOptions: (() => Promise<void>) | FuzzTestOptions,
	optionsOrFn?: FuzzTestOptions | (() => Promise<void>)
) => {
	if (typeof fnOrOptions === 'function') {
		return createFuzzTest(name, fnOrOptions, optionsOrFn as FuzzTestOptions)
	} else {
		return createFuzzTest(name, optionsOrFn as () => Promise<void>, fnOrOptions)
	}
}

/**
 * Extended test object with fuzz method
 */
export const test = Object.assign(vitestTest, { fuzz })

// Re-export vitest test types
export { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
