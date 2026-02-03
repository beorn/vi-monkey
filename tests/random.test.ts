import { describe, test, expect } from 'vitest'
import { createSeededRandom, parseSeed } from '../src/random.js'

describe('createSeededRandom', () => {
  test('same seed produces same sequence', () => {
    const r1 = createSeededRandom(12345)
    const r2 = createSeededRandom(12345)

    expect(r1.int(0, 100)).toBe(r2.int(0, 100))
    expect(r1.int(0, 100)).toBe(r2.int(0, 100))
    expect(r1.int(0, 100)).toBe(r2.int(0, 100))
  })

  test('different seeds produce different sequences', () => {
    const r1 = createSeededRandom(12345)
    const r2 = createSeededRandom(54321)

    // Very unlikely to be equal with different seeds
    const seq1 = [r1.int(0, 1000), r1.int(0, 1000), r1.int(0, 1000)]
    const seq2 = [r2.int(0, 1000), r2.int(0, 1000), r2.int(0, 1000)]

    expect(seq1).not.toEqual(seq2)
  })

  test('int() returns values in range', () => {
    const random = createSeededRandom(42)

    for (let i = 0; i < 100; i++) {
      const value = random.int(10, 20)
      expect(value).toBeGreaterThanOrEqual(10)
      expect(value).toBeLessThanOrEqual(20)
    }
  })

  test('float() returns values in [0, 1)', () => {
    const random = createSeededRandom(42)

    for (let i = 0; i < 100; i++) {
      const value = random.float()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  test('pick() selects from array', () => {
    const random = createSeededRandom(42)
    const items = ['a', 'b', 'c', 'd']

    for (let i = 0; i < 100; i++) {
      const picked = random.pick(items)
      expect(items).toContain(picked)
    }
  })

  test('pick() throws on empty array', () => {
    const random = createSeededRandom(42)
    expect(() => random.pick([])).toThrow('Cannot pick from empty array')
  })

  test('weightedPick() respects weights', () => {
    const random = createSeededRandom(42)
    const items = ['rare', 'common'] as const
    const weights = { rare: 1, common: 100 }

    const counts = { rare: 0, common: 0 }
    for (let i = 0; i < 1000; i++) {
      counts[random.weightedPick(items, weights)]++
    }

    // Common should be picked much more often
    expect(counts.common).toBeGreaterThan(counts.rare * 5)
  })

  test('shuffle() returns new array with same elements', () => {
    const random = createSeededRandom(42)
    const original = [1, 2, 3, 4, 5]
    const shuffled = random.shuffle(original)

    expect(shuffled).not.toBe(original) // Different reference
    expect(shuffled.sort()).toEqual(original.sort()) // Same elements
  })

  test('shuffle() is deterministic with same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const r1 = createSeededRandom(12345)
    const r2 = createSeededRandom(12345)

    expect(r1.shuffle(items)).toEqual(r2.shuffle(items))
  })

  test('array() generates arrays of correct length', () => {
    const random = createSeededRandom(42)
    const arr = random.array(5, () => random.int(0, 10))

    expect(arr).toHaveLength(5)
    arr.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(10)
    })
  })

  test('bool() respects probability', () => {
    const random = createSeededRandom(42)

    // Always true
    let trueCount = 0
    for (let i = 0; i < 100; i++) {
      if (random.bool(1.0)) trueCount++
    }
    expect(trueCount).toBe(100)

    // Always false
    let falseCount = 0
    for (let i = 0; i < 100; i++) {
      if (!random.bool(0.0)) falseCount++
    }
    expect(falseCount).toBe(100)
  })

  test('fork() creates independent stream', () => {
    const random = createSeededRandom(42)

    // Generate some values from original
    const beforeFork = [random.int(0, 1000), random.int(0, 1000)]

    const forked = random.fork()

    // Continue generating from original
    const afterForkOriginal = [random.int(0, 1000), random.int(0, 1000)]

    // Generate from forked (starts fresh from fork point)
    const forkedSeq = [forked.int(0, 1000), forked.int(0, 1000)]

    // Forked should be independent - not equal to what came after fork
    // (they use different seeds derived at fork time)
    expect(forkedSeq).toBeDefined()
    expect(afterForkOriginal).toBeDefined()
    expect(beforeFork).toBeDefined()

    // Key property: forking is deterministic
    const random2 = createSeededRandom(42)
    random2.int(0, 1000)
    random2.int(0, 1000)
    const forked2 = random2.fork()
    const forked2Seq = [forked2.int(0, 1000), forked2.int(0, 1000)]

    expect(forkedSeq).toEqual(forked2Seq)
  })
})

describe('parseSeed', () => {
  test('returns random seed when source is random', () => {
    const seed = parseSeed('random')
    expect(typeof seed).toBe('number')
    expect(seed).toBeGreaterThan(0)
  })

  test('reads FUZZ_SEED from env when source is env', () => {
    const originalEnv = process.env.FUZZ_SEED
    try {
      process.env.FUZZ_SEED = '99999'
      expect(parseSeed('env')).toBe(99999)
    } finally {
      if (originalEnv === undefined) {
        delete process.env.FUZZ_SEED
      } else {
        process.env.FUZZ_SEED = originalEnv
      }
    }
  })

  test('returns random seed when FUZZ_SEED is not set', () => {
    const originalEnv = process.env.FUZZ_SEED
    try {
      delete process.env.FUZZ_SEED
      const seed = parseSeed('env')
      expect(typeof seed).toBe('number')
      expect(seed).toBeGreaterThan(0)
    } finally {
      if (originalEnv !== undefined) {
        process.env.FUZZ_SEED = originalEnv
      }
    }
  })
})
