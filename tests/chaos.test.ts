/**
 * Tests for chaos stream transformers
 */

import { describe, test, expect } from "vitest"
import { createSeededRandom } from "../src/random.js"
import {
  drop,
  reorder,
  duplicate,
  burst,
  initGap,
  delay,
  chaos,
  builtinChaosRegistry,
  type ChaosRegistry,
} from "../src/chaos/index.js"

// Helper: collect all items from an async iterable
async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of source) {
    items.push(item)
  }
  return items
}

// Helper: create an async iterable from an array
async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item
}

const ITEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

describe("chaos transformers", () => {
  describe("drop", () => {
    test("drops items probabilistically", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(drop(fromArray(ITEMS), 0.5, rng))

      // Some items should be dropped
      expect(result.length).toBeLessThan(ITEMS.length)
      expect(result.length).toBeGreaterThan(0)

      // All surviving items should be from original
      for (const item of result) {
        expect(ITEMS).toContain(item)
      }
    })

    test("rate 0 drops nothing", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(drop(fromArray(ITEMS), 0, rng))
      expect(result).toEqual(ITEMS)
    })

    test("rate 1 drops everything", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(drop(fromArray(ITEMS), 1, rng))
      expect(result).toEqual([])
    })

    test("is deterministic with same seed", async () => {
      const result1 = await collect(drop(fromArray(ITEMS), 0.3, createSeededRandom(123)))
      const result2 = await collect(drop(fromArray(ITEMS), 0.3, createSeededRandom(123)))
      expect(result1).toEqual(result2)
    })
  })

  describe("reorder", () => {
    test("shuffles items within window", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(reorder(fromArray(ITEMS), 5, rng))

      // Same items, potentially different order
      expect(result.sort((a, b) => a - b)).toEqual(ITEMS)
    })

    test("window size 1 preserves order", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(reorder(fromArray(ITEMS), 1, rng))
      expect(result).toEqual(ITEMS)
    })

    test("preserves all items", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(reorder(fromArray(ITEMS), 3, rng))
      expect(result.length).toBe(ITEMS.length)
      expect(result.sort((a, b) => a - b)).toEqual(ITEMS)
    })

    test("is deterministic with same seed", async () => {
      const result1 = await collect(reorder(fromArray(ITEMS), 5, createSeededRandom(123)))
      const result2 = await collect(reorder(fromArray(ITEMS), 5, createSeededRandom(123)))
      expect(result1).toEqual(result2)
    })
  })

  describe("duplicate", () => {
    test("duplicates some items", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(duplicate(fromArray(ITEMS), 0.5, rng))

      // Should have more items than original
      expect(result.length).toBeGreaterThan(ITEMS.length)

      // All items should be from original
      for (const item of result) {
        expect(ITEMS).toContain(item)
      }
    })

    test("rate 0 duplicates nothing", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(duplicate(fromArray(ITEMS), 0, rng))
      expect(result).toEqual(ITEMS)
    })

    test("rate 1 duplicates everything", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(duplicate(fromArray(ITEMS), 1, rng))
      expect(result.length).toBe(ITEMS.length * 2)
    })

    test("preserves order (dupes adjacent)", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(duplicate(fromArray([1, 2, 3]), 1, rng))
      // Each item appears twice, in order
      expect(result).toEqual([1, 1, 2, 2, 3, 3])
    })
  })

  describe("burst", () => {
    test("buffers then flushes", async () => {
      const result = await collect(burst(fromArray(ITEMS), 5))
      // All items preserved, same order
      expect(result).toEqual(ITEMS)
    })

    test("flushes remainder", async () => {
      // 10 items with burst size 3: 3+3+3+1
      const result = await collect(burst(fromArray(ITEMS), 3))
      expect(result).toEqual(ITEMS)
    })

    test("burst size larger than input", async () => {
      const result = await collect(burst(fromArray(ITEMS), 100))
      expect(result).toEqual(ITEMS)
    })

    test("burst size 1 is identity", async () => {
      const result = await collect(burst(fromArray(ITEMS), 1))
      expect(result).toEqual(ITEMS)
    })
  })

  describe("initGap", () => {
    test("skips first N items", async () => {
      const result = await collect(initGap(fromArray(ITEMS), 3))
      expect(result).toEqual([4, 5, 6, 7, 8, 9, 10])
    })

    test("skip 0 is identity", async () => {
      const result = await collect(initGap(fromArray(ITEMS), 0))
      expect(result).toEqual(ITEMS)
    })

    test("skip more than length yields empty", async () => {
      const result = await collect(initGap(fromArray(ITEMS), 100))
      expect(result).toEqual([])
    })
  })

  describe("delay", () => {
    test("yields all items with delays", async () => {
      const rng = createSeededRandom(42)
      const start = Date.now()
      const result = await collect(delay(fromArray([1, 2, 3]), 0, 1, rng))
      expect(result).toEqual([1, 2, 3])
      // Should complete quickly with 0-1ms delays
      expect(Date.now() - start).toBeLessThan(100)
    })
  })

  describe("chaos combinator", () => {
    test("composes multiple transformers", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(
        chaos(
          fromArray(ITEMS),
          [
            { type: "drop", params: { rate: 0.2 } },
            { type: "duplicate", params: { rate: 0.1 } },
          ],
          rng,
        ),
      )

      // Some items dropped, some duplicated — count varies
      expect(result.length).toBeGreaterThan(0)
      for (const item of result) {
        expect(ITEMS).toContain(item)
      }
    })

    test("empty configs is identity", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(chaos(fromArray(ITEMS), [], rng))
      expect(result).toEqual(ITEMS)
    })

    test("unknown type is ignored", async () => {
      const rng = createSeededRandom(42)
      const result = await collect(chaos(fromArray(ITEMS), [{ type: "nonexistent", params: {} }], rng))
      expect(result).toEqual(ITEMS)
    })

    test("custom registry extends built-in", async () => {
      const rng = createSeededRandom(42)

      // Custom transformer that doubles every item
      const customRegistry: ChaosRegistry<number> = {
        ...(builtinChaosRegistry as ChaosRegistry<number>),
        double: async function* (source) {
          for await (const item of source) {
            yield item * 2
          }
        },
      }

      const result = await collect(chaos(fromArray([1, 2, 3]), [{ type: "double", params: {} }], rng, customRegistry))
      expect(result).toEqual([2, 4, 6])
    })

    test("is deterministic with same seed", async () => {
      const configs = [
        { type: "drop", params: { rate: 0.3 } },
        { type: "reorder", params: { windowSize: 3 } },
        { type: "duplicate", params: { rate: 0.2 } },
      ]

      const result1 = await collect(chaos(fromArray(ITEMS), configs, createSeededRandom(42)))
      const result2 = await collect(chaos(fromArray(ITEMS), configs, createSeededRandom(42)))
      expect(result1).toEqual(result2)
    })
  })

  describe("composition", () => {
    test("transformers compose via piping", async () => {
      const rng = createSeededRandom(42)

      // Manual composition (same as chaos combinator)
      const base = fromArray(ITEMS)
      const dropped = drop(base, 0.2, rng)
      const reordered = reorder(dropped, 3, rng)

      const result = await collect(reordered)
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBeLessThanOrEqual(ITEMS.length)
    })

    test("works with non-numeric types", async () => {
      const rng = createSeededRandom(42)
      const strings = ["alpha", "beta", "gamma", "delta", "epsilon"]

      const result = await collect(
        chaos(
          fromArray(strings),
          [
            { type: "drop", params: { rate: 0.2 } },
            { type: "reorder", params: { windowSize: 3 } },
          ],
          rng,
        ),
      )

      expect(result.length).toBeGreaterThan(0)
      for (const item of result) {
        expect(strings).toContain(item)
      }
    })

    test("works with object types", async () => {
      const rng = createSeededRandom(42)
      const events = [
        { type: "click", x: 10, y: 20 },
        { type: "move", x: 30, y: 40 },
        { type: "click", x: 50, y: 60 },
      ]

      const result = await collect(duplicate(fromArray(events), 0.5, rng))

      expect(result.length).toBeGreaterThanOrEqual(events.length)
      for (const item of result) {
        expect(events).toContainEqual(item)
      }
    })
  })
})
