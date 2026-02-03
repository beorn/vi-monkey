/**
 * Shrinking - find minimal failing sequence via delta debugging
 *
 * Uses binary search to reduce a failing sequence to the smallest
 * subsequence that still triggers the failure.
 */

export interface ShrinkOptions {
	/** Maximum shrinking attempts (default: 100) */
	maxAttempts?: number
	/** Minimum sequence length to try (default: 1) */
	minLength?: number
}

export interface ShrinkResult<T> {
	/** Original sequence */
	original: T[]
	/** Shrunk (minimal) sequence */
	shrunk: T[]
	/** Number of shrinking attempts made */
	attempts: number
	/** Whether shrinking found a smaller sequence */
	reduced: boolean
}

/**
 * Shrink a failing sequence to its minimal form
 *
 * Uses delta debugging algorithm:
 * 1. Try removing first half - if still fails, keep only first half
 * 2. Try removing second half - if still fails, keep only second half
 * 3. Try removing individual elements from start/end
 * 4. Repeat until no reduction possible
 *
 * @param sequence - The original failing sequence
 * @param runTest - Function that returns true if sequence passes, false if fails
 * @param options - Shrinking options
 */
export async function shrinkSequence<T>(
	sequence: T[],
	runTest: (seq: T[]) => Promise<boolean>,
	options: ShrinkOptions = {}
): Promise<ShrinkResult<T>> {
	const { maxAttempts = 100, minLength = 1 } = options

	let current = [...sequence]
	let attempts = 0
	let changed = true

	while (changed && attempts < maxAttempts && current.length > minLength) {
		changed = false

		// Try removing first half
		if (current.length > 1) {
			const half = Math.ceil(current.length / 2)
			const secondHalf = current.slice(half)
			attempts++

			if (secondHalf.length >= minLength && !(await runTest(secondHalf))) {
				// Second half alone still fails
				current = secondHalf
				changed = true
				continue
			}
		}

		// Try removing second half
		if (current.length > 1) {
			const half = Math.floor(current.length / 2)
			const firstHalf = current.slice(0, half)
			attempts++

			if (firstHalf.length >= minLength && !(await runTest(firstHalf))) {
				// First half alone still fails
				current = firstHalf
				changed = true
				continue
			}
		}

		// Try removing individual elements
		for (let i = 0; i < current.length && attempts < maxAttempts; i++) {
			const without = [...current.slice(0, i), ...current.slice(i + 1)]
			attempts++

			if (without.length >= minLength && !(await runTest(without))) {
				// Removing element i still fails
				current = without
				changed = true
				break
			}
		}
	}

	return {
		original: sequence,
		shrunk: current,
		attempts,
		reduced: current.length < sequence.length,
	}
}

/**
 * Format shrink result for display
 */
export function formatShrinkResult<T>(result: ShrinkResult<T>): string {
	const reduction = result.original.length - result.shrunk.length
	const percent = Math.round((reduction / result.original.length) * 100)

	if (!result.reduced) {
		return `Could not reduce sequence (${result.original.length} steps, ${result.attempts} attempts)`
	}

	return `Shrunk from ${result.original.length} to ${result.shrunk.length} steps (${percent}% reduction, ${result.attempts} attempts)`
}
