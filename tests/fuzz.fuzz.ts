/**
 * Tests for the fuzz API (gen, take, test.fuzz)
 */
import { describe, it, expect } from "vitest"
import {
  gen,
  take,
  createSeededRandom,
  fuzzContext,
  createFuzzContext,
  createReplayContext,
  shrinkSequence,
} from "../src/fuzz/index.js"

describe("gen()", () => {
  it("generates from array picker", async () => {
    const values: string[] = []
    for await (const v of take(gen(["a", "b", "c"], 42), 10)) {
      values.push(v)
    }
    expect(values).toHaveLength(10)
    expect(values.every((v) => ["a", "b", "c"].includes(v))).toBe(true)
  })

  it("is deterministic with same seed", async () => {
    const values1: string[] = []
    const values2: string[] = []

    for await (const v of take(gen(["a", "b", "c"], 12345), 20)) {
      values1.push(v)
    }
    for await (const v of take(gen(["a", "b", "c"], 12345), 20)) {
      values2.push(v)
    }

    expect(values1).toEqual(values2)
  })

  it("generates from weighted picker", async () => {
    const counts = { a: 0, b: 0, c: 0 }

    // 80% a, 15% b, 5% c
    for await (const v of take(
      gen(
        [
          [80, "a"],
          [15, "b"],
          [5, "c"],
        ],
        42,
      ),
      1000,
    )) {
      counts[v as keyof typeof counts]++
    }

    // With 1000 samples, 'a' should dominate
    expect(counts.a).toBeGreaterThan(counts.b)
    expect(counts.b).toBeGreaterThan(counts.c)
  })

  it("generates from function picker", async () => {
    const values: number[] = []

    for await (const v of take(
      gen(({ random, iteration }) => random.int(0, 10) + iteration, 42),
      5,
    )) {
      values.push(v)
    }

    expect(values).toHaveLength(5)
    // Values should increase due to iteration
    expect(values[4]).toBeGreaterThan(values[0])
  })

  it("flattens array results from picker", async () => {
    const values: string[] = []

    // Picker returns arrays that should be flattened
    for await (const v of take(
      gen(() => ["x", "y", "z"], 42),
      6,
    )) {
      values.push(v)
    }

    // Should yield individual items: x, y, z, x, y, z
    expect(values).toEqual(["x", "y", "z", "x", "y", "z"])
  })
})

describe("take()", () => {
  it("limits iterations", async () => {
    const values: number[] = []
    let i = 0

    const infinite = async function* () {
      while (true) yield i++
    }

    for await (const v of take(infinite(), 5)) {
      values.push(v)
    }

    expect(values).toEqual([0, 1, 2, 3, 4])
  })

  it("tracks values in fuzz context", async () => {
    const ctx = createFuzzContext(42)

    await fuzzContext.run(ctx, async () => {
      for await (const v of take(gen(["a", "b"], 42), 5)) {
        // just consume
      }
    })

    expect(ctx.history).toHaveLength(5)
  })

  it("replays from context sequence", async () => {
    const ctx = createReplayContext(["x", "y", "z"], 42)
    const values: string[] = []

    await fuzzContext.run(ctx, async () => {
      // gen() is ignored in replay mode - values come from context
      for await (const v of take(gen(["a", "b", "c"], 42), 10)) {
        values.push(v)
      }
    })

    // Should replay only the saved sequence
    expect(values).toEqual(["x", "y", "z"])
  })
})

describe("createSeededRandom()", () => {
  it("is deterministic", () => {
    const r1 = createSeededRandom(12345)
    const r2 = createSeededRandom(12345)

    expect(r1.int(0, 100)).toBe(r2.int(0, 100))
    expect(r1.float()).toBe(r2.float())
    expect(r1.pick(["a", "b", "c"])).toBe(r2.pick(["a", "b", "c"]))
  })

  it("provides pick, int, float, shuffle", () => {
    const r = createSeededRandom(42)

    expect(typeof r.int(0, 10)).toBe("number")
    expect(r.int(0, 10)).toBeLessThanOrEqual(10)
    expect(r.int(0, 10)).toBeGreaterThanOrEqual(0)

    expect(typeof r.float()).toBe("number")
    expect(r.float()).toBeLessThan(1)
    expect(r.float()).toBeGreaterThanOrEqual(0)

    expect(["a", "b", "c"]).toContain(r.pick(["a", "b", "c"]))

    const shuffled = r.shuffle([1, 2, 3, 4, 5])
    expect(shuffled).toHaveLength(5)
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe("shrinkSequence()", () => {
  it("finds minimal failing sequence", async () => {
    // Test that fails only when sequence contains 'x' followed by 'y'
    const runTest = async (seq: string[]) => {
      for (let i = 0; i < seq.length - 1; i++) {
        if (seq[i] === "x" && seq[i + 1] === "y") {
          return false // fails
        }
      }
      return true // passes
    }

    const result = await shrinkSequence(["a", "b", "x", "y", "c", "d"], runTest)

    expect(result.reduced).toBe(true)
    expect(result.shrunk).toEqual(["x", "y"])
  })

  it("returns original if cannot reduce", async () => {
    // Test that fails for any non-empty sequence
    const runTest = async (seq: string[]) => seq.length === 0

    const result = await shrinkSequence(["a", "b", "c"], runTest)

    // Can reduce to single element
    expect(result.shrunk).toHaveLength(1)
  })

  it("respects minLength option", async () => {
    const runTest = async () => false // always fails

    const result = await shrinkSequence(["a", "b", "c", "d", "e"], runTest, {
      minLength: 3,
    })

    expect(result.shrunk.length).toBeGreaterThanOrEqual(3)
  })
})

describe("stateful generators", () => {
  it("supports closure-based state access", async () => {
    // Simulate stateful generator pattern from the plan
    let counter = 0

    const stateful = async function* () {
      while (true) {
        // Closure captures counter
        yield counter < 3 ? "increment" : "reset"
      }
    }

    const actions: string[] = []
    for await (const action of take(stateful(), 5)) {
      actions.push(action)
      if (action === "increment") counter++
      else counter = 0
    }

    // First 3 should be increment, then reset
    expect(actions).toEqual([
      "increment",
      "increment",
      "increment",
      "reset",
      "increment",
    ])
  })
})
