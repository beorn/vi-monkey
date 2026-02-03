import { describe, test, expect } from 'vitest'
import { defineGenerator, generateAction } from '../src/fuzz/generator.js'
import { createSeededRandom } from '../src/random.js'

describe('defineGenerator', () => {
  test('creates generator with defaults', () => {
    const generator = defineGenerator({
      actions: ['a', 'b', 'c'],
    })

    expect(generator.actions).toEqual(['a', 'b', 'c'])
    expect(generator.maxSteps).toBe(100) // default
    expect(generator.weights).toBeUndefined()
    expect(generator.generate).toBeUndefined()
  })

  test('creates generator with custom options', () => {
    const generator = defineGenerator({
      actions: ['x', 'y'],
      weights: { x: 10, y: 1 },
      maxSteps: 50,
    })

    expect(generator.actions).toEqual(['x', 'y'])
    expect(generator.maxSteps).toBe(50)
    expect(generator.weights).toEqual({ x: 10, y: 1 })
  })

  test('creates generator with custom generate function', () => {
    const customGenerate = () => 'custom' as const
    const generator = defineGenerator({
      actions: ['a', 'b'],
      generate: customGenerate,
    })

    expect(generator.generate).toBe(customGenerate)
  })
})

describe('generateAction', () => {
  test('picks from actions uniformly without weights', () => {
    const generator = defineGenerator({
      actions: ['a', 'b', 'c'] as const,
    })

    const random = createSeededRandom(42)
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 }

    for (let i = 0; i < 300; i++) {
      const action = generateAction(generator, random, {})
      counts[action]++
    }

    // Each should be roughly 100 (1/3 of 300)
    expect(counts.a).toBeGreaterThan(50)
    expect(counts.b).toBeGreaterThan(50)
    expect(counts.c).toBeGreaterThan(50)
  })

  test('respects weights', () => {
    const generator = defineGenerator({
      actions: ['rare', 'common'] as const,
      weights: { rare: 1, common: 99 },
    })

    const random = createSeededRandom(42)
    const counts = { rare: 0, common: 0 }

    for (let i = 0; i < 1000; i++) {
      const action = generateAction(generator, random, {})
      counts[action]++
    }

    // Common should be picked much more often
    expect(counts.common).toBeGreaterThan(counts.rare * 10)
  })

  test('uses custom generate function when provided', () => {
    const generator = defineGenerator({
      actions: ['a', 'b'],
      generate: () => 'custom' as 'a' | 'b',
    })

    const random = createSeededRandom(42)
    const action = generateAction(generator, random, {})

    expect(action).toBe('custom')
  })

  test('custom generate receives state', () => {
    let receivedState: unknown

    const generator = defineGenerator({
      actions: ['a', 'b'] as const,
      generate: (_random, state) => {
        receivedState = state
        return 'a'
      },
    })

    const random = createSeededRandom(42)
    const testState = { foo: 'bar' }
    generateAction(generator, random, testState)

    expect(receivedState).toEqual(testState)
  })

  test('is deterministic with same seed', () => {
    const generator = defineGenerator({
      actions: ['a', 'b', 'c', 'd', 'e'] as const,
    })

    const random1 = createSeededRandom(12345)
    const random2 = createSeededRandom(12345)

    const seq1: string[] = []
    const seq2: string[] = []

    for (let i = 0; i < 20; i++) {
      seq1.push(generateAction(generator, random1, {}))
      seq2.push(generateAction(generator, random2, {}))
    }

    expect(seq1).toEqual(seq2)
  })
})
