import { describe, test, expect } from 'vitest'
import { compareChoosers, measureDiscovery } from '../src/compare/index.js'
import { createReplayChooser, createRandomChooser } from '../src/chooser/index.js'
import { defineGenerator } from '../src/fuzz/generator.js'
import { defineSurface } from '../src/surfaces/types.js'
import { defineInvariants } from '../src/invariants/dsl.js'
import { createSeededRandom } from '../src/random.js'

const counterSurface = defineSurface({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
  },
  getState: (state) => ({ value: state.value }),
})

const passingInvariants = defineInvariants({
  finite: (s: { value: number }) => {
    if (!Number.isFinite(s.value)) return 'Value is not finite'
    return true
  },
})

const failingInvariants = defineInvariants({
  nonNegative: (s: { value: number }) => {
    if (s.value < 0) return `Value ${s.value} is negative`
    return true
  },
})

describe('compareChoosers', () => {
  test('compares multiple choosers', async () => {
    const choosers = [
      createReplayChooser(['inc', 'inc'] as const),
      createReplayChooser(['dec', 'dec'] as const),
    ]

    const result = await compareChoosers(counterSurface, passingInvariants, choosers, {
      maxSteps: 10,
    })

    expect(result.results).toHaveLength(2)
    expect(result.summary).toHaveLength(2)
  })

  test('detects failures', async () => {
    const choosers = [
      createReplayChooser(['inc', 'inc'] as const),
      createReplayChooser(['dec', 'dec'] as const), // Will go negative
    ]

    const result = await compareChoosers(counterSurface, failingInvariants, choosers, {
      maxSteps: 10,
    })

    expect(result.allPassed).toBe(false)

    const incResult = result.results.find((r) => r.chooser === 'replay')
    // First replay chooser does 'inc, inc' - should pass
    const decResult = result.results.filter((r) => r.chooser === 'replay')[1]
    // Second replay chooser does 'dec, dec' - should fail on first dec

    // At least one should fail
    expect(result.results.some((r) => !r.passed)).toBe(true)
  })

  test('handles stalled choosers', async () => {
    const choosers = [createReplayChooser(['inc'] as const)] // Short sequence

    const result = await compareChoosers(counterSurface, passingInvariants, choosers, {
      maxSteps: 10,
    })

    expect(result.results[0].runResult.stalled).toBe(true)
    expect(result.results[0].runResult.steps).toBe(1)
  })

  test('identifies best chooser (bug finder)', async () => {
    const generator = defineGenerator({
      actions: ['inc', 'dec'] as const,
    })

    const choosers = [
      createReplayChooser(['inc', 'inc', 'inc'] as const),
      createReplayChooser(['dec'] as const), // Finds bug immediately
      createRandomChooser(generator, createSeededRandom(12345)),
    ]

    const result = await compareChoosers(counterSurface, failingInvariants, choosers, {
      maxSteps: 10,
    })

    // The replay that does 'dec' finds the bug fastest
    expect(result.bestChooser).toBe('replay')
  })
})

describe('measureDiscovery', () => {
  test('measures bug discovery stats', async () => {
    const generator = defineGenerator({
      actions: ['inc', 'dec'] as const,
    })

    const chooser = createRandomChooser(generator, createSeededRandom(12345))

    const stats = await measureDiscovery(counterSurface, failingInvariants, chooser, {
      iterations: 10,
      maxSteps: 50,
    })

    expect(stats.chooser).toBe('random')
    expect(stats.iterations).toBe(10)
    expect(stats.totalSteps).toBeGreaterThan(0)
    // May or may not find bugs depending on random seed
  })

  test('tracks unique bugs', async () => {
    // Surface that can fail multiple ways
    const multiBugSurface = defineSurface({
      create: () => ({ a: 0, b: 0 }),
      sendAction: (state, action) => {
        if (action === 'decA') state.a--
        if (action === 'decB') state.b--
      },
      getState: (state) => ({ a: state.a, b: state.b }),
    })

    const multiInvariants = defineInvariants({
      aPositive: (s: { a: number }) => {
        if (s.a < 0) return 'a is negative'
        return true
      },
      bPositive: (s: { b: number }) => {
        if (s.b < 0) return 'b is negative'
        return true
      },
    })

    const generator = defineGenerator({
      actions: ['decA', 'decB'] as const,
    })

    const chooser = createRandomChooser(generator, createSeededRandom(99999))

    const stats = await measureDiscovery(multiBugSurface, multiInvariants, chooser, {
      iterations: 20,
      maxSteps: 10,
    })

    // Should find some bugs
    expect(stats.bugsFound).toBeGreaterThan(0)
    // May find 1 or 2 unique invariant violations
    expect(stats.uniqueBugs).toBeGreaterThanOrEqual(1)
    expect(stats.uniqueBugs).toBeLessThanOrEqual(2)
  })
})
