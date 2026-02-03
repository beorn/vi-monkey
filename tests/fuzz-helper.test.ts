import { describe, test, expect } from 'vitest'
import { defineSurface } from '../src/surfaces/types.js'
import { defineGenerator } from '../src/fuzz/generator.js'
import { defineInvariants } from '../src/invariants/dsl.js'
import { fuzz } from '../src/fuzz/index.js'

// Simple counter for testing
interface CounterState {
  value: number
}

const counterSurface = defineSurface<CounterState, 'inc' | 'dec', CounterState>({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
  },
  getState: (state) => ({ ...state }),
})

const counterGenerator = defineGenerator({
  actions: ['inc', 'dec'] as const,
  maxSteps: 20,
})

describe('fuzz() helper', () => {
  test('returns passed=true when invariants hold', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const result = await fuzz(counterSurface, counterGenerator, invariants, {
      seed: 12345,
    })

    expect(result.passed).toBe(true)
  })

  test('returns passed=false with shrunk sequence on failure', async () => {
    const invariants = defineInvariants<CounterState>({
      small: (s) => s.value < 3,
    })

    // Use a generator that only increments
    const incGenerator = defineGenerator({
      actions: ['inc'] as const,
      maxSteps: 10,
    })

    const result = await fuzz(counterSurface, incGenerator, invariants, {
      seed: 12345,
      shrink: true,
    })

    expect(result.passed).toBe(false)
    expect(result.shrunk).toBeDefined()
    // Should shrink to minimal: 3 increments to reach value=3
    expect(result.shrunk).toEqual(['inc', 'inc', 'inc'])
  })

  test('can disable shrinking', async () => {
    const invariants = defineInvariants<CounterState>({
      small: (s) => s.value < 3,
    })

    const incGenerator = defineGenerator({
      actions: ['inc'] as const,
      maxSteps: 10,
    })

    const result = await fuzz(counterSurface, incGenerator, invariants, {
      seed: 12345,
      shrink: false,
    })

    expect(result.passed).toBe(false)
    expect(result.shrunk).toBeUndefined()
  })

  test('is reproducible with same seed', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const result1 = await fuzz(counterSurface, counterGenerator, invariants, { seed: 42 })
    const result2 = await fuzz(counterSurface, counterGenerator, invariants, { seed: 42 })

    expect(result1.actions).toEqual(result2.actions)
  })
})
