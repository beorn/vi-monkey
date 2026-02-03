/**
 * Ergonomic generator API for fuzz testing
 *
 * gen(picker) creates an infinite async generator from a picker.
 * take(generator, n) limits iterations and auto-tracks in test.fuzz().
 */

import { createSeededRandom, type SeededRandom } from '../random.js'
import { fuzzContext } from './context.js'

/**
 * Picker context passed to picker functions
 */
export interface PickerContext {
	/** Seeded random number generator */
	random: SeededRandom
	/** Current iteration (0-indexed) */
	iteration: number
}

/**
 * Result type for picker functions - can return single value, array, or iterable
 */
type PickerResult<T> = T | T[] | Iterable<T>

/**
 * Sync picker function
 */
type SyncPickerFn<T> = (ctx: PickerContext) => PickerResult<T>

/**
 * Async picker function (for AI mode)
 */
type AsyncPickerFn<T> = (ctx: PickerContext) => Promise<PickerResult<T>>

/**
 * Picker types:
 * - T[] - random from array
 * - [number, T][] - weighted random (pairs of [weight, value])
 * - (ctx) => T | T[] | Iterable<T> - sync function
 * - (ctx) => Promise<T | T[] | Iterable<T>> - async function
 */
export type Picker<T> = T[] | [number, T][] | SyncPickerFn<T> | AsyncPickerFn<T>

/**
 * Type guard for weighted tuples
 */
function isWeightedTuple<T>(picker: unknown): picker is [number, T][] {
	return (
		Array.isArray(picker) && picker.length > 0 && Array.isArray(picker[0]) && typeof picker[0][0] === 'number'
	)
}

/**
 * Type guard for iterables (excluding strings)
 */
function isIterable<T>(value: unknown): value is Iterable<T> {
	return value !== null && typeof value === 'object' && Symbol.iterator in value && typeof value !== 'string'
}

/**
 * Flatten picker result: single value, array, or iterable → individual items
 */
function* flatten<T>(result: PickerResult<T>): Generator<T> {
	if (Array.isArray(result)) {
		for (const item of result) yield item
	} else if (isIterable(result)) {
		for (const item of result) yield item
	} else {
		yield result
	}
}

/**
 * Create a picker function from various picker specs
 */
function createPicker<T>(picker: Picker<T>, random: SeededRandom): (ctx: PickerContext) => PickerResult<T> | Promise<PickerResult<T>> {
	// Function picker - use as-is
	if (typeof picker === 'function') {
		return picker
	}

	// Weighted tuple picker
	if (isWeightedTuple<T>(picker)) {
		const items = picker
		const total = items.reduce((sum, [w]) => sum + w, 0)
		return () => {
			let r = random.float() * total
			for (const [weight, value] of items) {
				r -= weight
				if (r <= 0) return value
			}
			return items[items.length - 1][1]
		}
	}

	// Array picker - random from array
	return () => picker[Math.floor(random.float() * picker.length)]
}

/**
 * Create an infinite async generator from a picker
 *
 * @example
 * // Random from array
 * gen(['j', 'k', 'h', 'l'])
 *
 * @example
 * // Weighted random
 * gen([[40, 'j'], [40, 'k'], [20, 'Enter']])
 *
 * @example
 * // Custom picker function
 * gen(({ random }) => random.pick(['j', 'k']))
 *
 * @example
 * // Picker returns array (flattened)
 * gen(() => ['j', 'j', 'Enter'])  // yields: j, j, Enter, j, j, Enter, ...
 */
export async function* gen<T>(picker: Picker<T>, seed?: number): AsyncGenerator<T> {
	// Use context seed if available, otherwise provided seed or Date.now()
	const ctx = fuzzContext.getStore()
	const random = createSeededRandom(seed ?? ctx?.seed ?? Date.now())
	const pick = createPicker(picker, random)
	let iteration = 0

	while (true) {
		const pickerCtx: PickerContext = { random, iteration: iteration++ }
		const result = await pick(pickerCtx)
		yield* flatten(result)
	}
}

/**
 * Limit an async generator to n iterations
 *
 * When running inside test.fuzz(), automatically tracks yielded values
 * for shrinking and regression testing.
 *
 * @example
 * for await (const key of take(gen(['j', 'k']), 100)) {
 *   await handle.press(key)
 * }
 */
export async function* take<T>(generator: AsyncIterable<T>, n: number): AsyncGenerator<T> {
	const ctx = fuzzContext.getStore()
	let i = 0

	// Replay mode: yield from saved sequence instead of generator
	if (ctx?.replaySequence) {
		while (i < n && ctx.replayIndex < ctx.replaySequence.length) {
			yield ctx.replaySequence[ctx.replayIndex++] as T
			i++
		}
		return
	}

	// Normal mode: yield from generator, optionally record
	for await (const item of generator) {
		if (i++ >= n) break
		ctx?.history.push(item) // Track if in fuzz context
		yield item
	}
}
