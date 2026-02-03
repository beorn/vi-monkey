import { describe, test, expect } from 'vitest'
import { defineGenerator, generateAction, getAvailableActions } from '../src/fuzz/generator.js'
import { createSeededRandom } from '../src/random.js'
import { runFuzz } from '../src/fuzz/runner.js'
import { defineSurface } from '../src/surfaces/types.js'
import { defineInvariants } from '../src/invariants/dsl.js'

describe('preconditions', () => {
  test('getAvailableActions filters by precondition', () => {
    const generator = defineGenerator({
      actions: ['push', 'pop'] as const,
      preconditions: {
        pop: (state: { count: number }) => state.count > 0,
      },
    })

    // Empty state - pop not available
    const emptyAvailable = getAvailableActions(generator, { count: 0 })
    expect(emptyAvailable).toEqual(['push'])

    // Non-empty state - both available
    const nonEmptyAvailable = getAvailableActions(generator, { count: 5 })
    expect(nonEmptyAvailable).toEqual(['push', 'pop'])
  })

  test('generateAction respects preconditions', () => {
    const generator = defineGenerator({
      actions: ['push', 'pop'] as const,
      preconditions: {
        pop: (state: { count: number }) => state.count > 0,
      },
    })

    const random = createSeededRandom(12345)

    // When count is 0, can only get 'push'
    for (let i = 0; i < 10; i++) {
      const action = generateAction(generator, random, { count: 0 })
      expect(action).toBe('push')
    }
  })

  test('generateAction returns null when no actions available', () => {
    const generator = defineGenerator({
      actions: ['delete'] as const,
      preconditions: {
        delete: (state: { items: unknown[] }) => state.items.length > 0,
      },
    })

    const random = createSeededRandom(12345)

    // Empty items - no actions available
    const action = generateAction(generator, random, { items: [] })
    expect(action).toBe(null)
  })

  test('preconditions work with weighted selection', () => {
    const generator = defineGenerator({
      actions: ['a', 'b', 'c'] as const,
      weights: { a: 10, b: 5, c: 1 },
      preconditions: {
        a: (state: { flag: boolean }) => state.flag,
        b: () => true,
        c: () => true,
      },
    })

    const random = createSeededRandom(12345)

    // When flag is false, 'a' not available
    const actions = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const action = generateAction(generator, random, { flag: false })
      if (action) actions.add(action)
    }

    expect(actions.has('a')).toBe(false)
    expect(actions.has('b')).toBe(true)
    expect(actions.has('c')).toBe(true)
  })

  test('fuzz runner handles stall from preconditions', async () => {
    const surface = defineSurface({
      create: () => ({ items: ['a', 'b'] }),
      sendAction: (state, action) => {
        if (action === 'pop') state.items.pop()
      },
      getState: (state) => ({ items: [...state.items] }),
    })

    const generator = defineGenerator({
      actions: ['pop'] as const,
      preconditions: {
        pop: (state: { items: unknown[] }) => state.items.length > 0,
      },
      maxSteps: 10,
    })

    const invariants = defineInvariants({
      valid: () => true,
    })

    const result = await runFuzz(surface, generator, invariants, { seed: 12345 })

    // Should stop early when items are exhausted
    expect(result.passed).toBe(true)
    expect(result.steps).toBe(2) // Only 2 pops possible
    expect(result.actions).toEqual(['pop', 'pop'])
  })
})
