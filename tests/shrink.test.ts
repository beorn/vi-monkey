import { describe, test, expect } from 'vitest'
import { defineSurface } from '../src/surfaces/types.js'
import { defineInvariants } from '../src/invariants/dsl.js'
import { shrinkSequence } from '../src/fuzz/shrink.js'

// Simple counter that fails when value reaches threshold
interface CounterState {
  value: number
}

const counterSurface = defineSurface<CounterState, string, CounterState>({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
  },
  getState: (state) => ({ ...state }),
})

const invariants = defineInvariants<CounterState>({
  belowThreshold: (s) => s.value < 5,
})

describe('shrinkSequence', () => {
  test('shrinks to minimal failing sequence', async () => {
    // Original sequence: 10 increments (fails at 5th)
    const original = Array(10).fill('inc')

    const result = await shrinkSequence(
      counterSurface,
      invariants,
      original,
      'belowThreshold',
      { maxAttempts: 50 }
    )

    expect(result.shrunk.length).toBeLessThan(result.original.length)
    // Should shrink to exactly 5 increments
    expect(result.shrunk).toEqual(['inc', 'inc', 'inc', 'inc', 'inc'])
  })

  test('removes irrelevant actions', async () => {
    // Sequence with noise: inc, dec, inc, dec, inc, inc, inc, inc, inc
    // The dec actions cancel out, but the 5 remaining incs cause failure
    const original = ['inc', 'dec', 'inc', 'dec', 'inc', 'inc', 'inc', 'inc', 'inc']

    const result = await shrinkSequence(
      counterSurface,
      invariants,
      original,
      'belowThreshold',
      { maxAttempts: 100 }
    )

    // Should find that we need 5 more incs than decs
    expect(result.shrunk.length).toBeLessThanOrEqual(7) // At most 5 inc + 0-2 dec/inc pairs
  })

  test('respects maxAttempts limit', async () => {
    const original = Array(100).fill('inc')

    const result = await shrinkSequence(
      counterSurface,
      invariants,
      original,
      'belowThreshold',
      { maxAttempts: 5 }
    )

    expect(result.attempts).toBeLessThanOrEqual(5)
    // May not fully shrink due to limit
    expect(result.shrunk.length).toBeLessThanOrEqual(original.length)
  })

  test('calls onAttempt callback', async () => {
    const original = Array(10).fill('inc')
    const attempts: Array<{ attempt: number; length: number }> = []

    await shrinkSequence(counterSurface, invariants, original, 'belowThreshold', {
      maxAttempts: 20,
      onAttempt: (attempt, sequence) => {
        attempts.push({ attempt, length: sequence.length })
      },
    })

    expect(attempts.length).toBeGreaterThan(0)
    expect(attempts[0].attempt).toBe(1)
  })

  test('returns original if cannot shrink', async () => {
    // Minimal sequence that fails
    const original = ['inc', 'inc', 'inc', 'inc', 'inc']

    const result = await shrinkSequence(
      counterSurface,
      invariants,
      original,
      'belowThreshold',
      { maxAttempts: 50 }
    )

    // Already minimal
    expect(result.shrunk).toEqual(original)
  })

  test('calculates reduction percentage', async () => {
    const original = Array(20).fill('inc')

    const result = await shrinkSequence(
      counterSurface,
      invariants,
      original,
      'belowThreshold',
      { maxAttempts: 50 }
    )

    // Should shrink from 20 to 5 = 75% reduction
    expect(result.reductionPercent).toBe(75)
  })
})
