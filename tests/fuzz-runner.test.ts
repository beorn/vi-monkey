import { describe, test, expect } from 'vitest'
import { defineSurface } from '../src/surfaces/types.js'
import { defineGenerator } from '../src/fuzz/generator.js'
import { defineInvariants } from '../src/invariants/dsl.js'
import { runFuzz, runFuzzIterations } from '../src/fuzz/runner.js'

// Simple counter for testing
interface CounterState {
  value: number
}

const counterSurface = defineSurface<CounterState, 'inc' | 'dec' | 'reset', CounterState>({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
    if (action === 'reset') state.value = 0
  },
  getState: (state) => ({ ...state }),
})

const counterGenerator = defineGenerator({
  actions: ['inc', 'dec', 'reset'] as const,
  maxSteps: 50,
})

describe('runFuzz', () => {
  test('passes when all invariants hold', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const result = await runFuzz(counterSurface, counterGenerator, invariants, {
      seed: 12345,
      maxSteps: 20,
    })

    expect(result.passed).toBe(true)
    expect(result.steps).toBe(20)
    expect(result.actions).toHaveLength(20)
  })

  test('fails when invariant is violated', async () => {
    const invariants = defineInvariants<CounterState>({
      // This will fail when value goes negative
      nonNegative: (s) => s.value >= 0,
    })

    // Use a generator that only decrements
    const decOnlyGenerator = defineGenerator({
      actions: ['dec'] as const,
      maxSteps: 10,
    })

    const result = await runFuzz(counterSurface, decOnlyGenerator, invariants, {
      seed: 12345,
    })

    expect(result.passed).toBe(false)
    expect(result.failure).toBeDefined()
    expect(result.failure!.invariant).toBe('nonNegative')
    expect(result.failure!.step).toBe(1) // Fails on first dec
  })

  test('is reproducible with same seed', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const result1 = await runFuzz(counterSurface, counterGenerator, invariants, {
      seed: 42,
      maxSteps: 30,
    })

    const result2 = await runFuzz(counterSurface, counterGenerator, invariants, {
      seed: 42,
      maxSteps: 30,
    })

    expect(result1.actions).toEqual(result2.actions)
  })

  test('different seeds produce different sequences', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const result1 = await runFuzz(counterSurface, counterGenerator, invariants, {
      seed: 12345,
      maxSteps: 30,
    })

    const result2 = await runFuzz(counterSurface, counterGenerator, invariants, {
      seed: 54321,
      maxSteps: 30,
    })

    expect(result1.actions).not.toEqual(result2.actions)
  })

  test('calls onStep callback', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const steps: Array<{ step: number; action: string }> = []

    await runFuzz(counterSurface, counterGenerator, invariants, {
      seed: 12345,
      maxSteps: 5,
      onStep: (step, action) => {
        steps.push({ step, action })
      },
    })

    expect(steps).toHaveLength(5)
    expect(steps[0].step).toBe(1)
    expect(steps[4].step).toBe(5)
  })

  test('checks initial state', async () => {
    // Surface that starts in invalid state
    const badSurface = defineSurface<CounterState, 'inc', CounterState>({
      create: () => ({ value: -1 }), // Starts negative!
      sendAction: (state) => {
        state.value++
      },
      getState: (state) => ({ ...state }),
    })

    const invariants = defineInvariants<CounterState>({
      nonNegative: (s) => s.value >= 0,
    })

    const generator = defineGenerator({
      actions: ['inc'] as const,
      maxSteps: 10,
    })

    const result = await runFuzz(badSurface, generator, invariants, { seed: 1 })

    expect(result.passed).toBe(false)
    expect(result.failure!.step).toBe(0) // Failed at initial state
    expect(result.failure!.action).toBe('(initial)')
  })
})

describe('runFuzzIterations', () => {
  test('runs multiple iterations', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const result = await runFuzzIterations(counterSurface, counterGenerator, invariants, {
      iterations: 10,
      baseSeed: 12345,
    })

    expect(result.passed).toBe(true)
    expect(result.iterations).toBe(10)
    expect(result.failures).toHaveLength(0)
  })

  test('stops on first failure with failFast', async () => {
    // Use a generator that only increments - guaranteed to fail quickly
    const incOnlyGenerator = defineGenerator({
      actions: ['inc'] as const,
      maxSteps: 50,
    })

    const invariants = defineInvariants<CounterState>({
      // Will fail when value reaches 5
      smallValue: (s) => s.value < 5,
    })

    const result = await runFuzzIterations(counterSurface, incOnlyGenerator, invariants, {
      iterations: 100,
      baseSeed: 12345,
      failFast: true,
    })

    expect(result.passed).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.iterations).toBe(1) // Should stop after first iteration
  })

  test('collects all failures without failFast', async () => {
    const invariants = defineInvariants<CounterState>({
      // Will eventually fail
      smallValue: (s) => Math.abs(s.value) < 3,
    })

    const result = await runFuzzIterations(counterSurface, counterGenerator, invariants, {
      iterations: 10,
      baseSeed: 12345,
      failFast: false,
    })

    expect(result.passed).toBe(false)
    expect(result.iterations).toBe(10)
    // Multiple iterations may fail
    expect(result.failures.length).toBeGreaterThanOrEqual(1)
  })

  test('calls onIteration callback', async () => {
    const invariants = defineInvariants<CounterState>({
      isNumber: (s) => typeof s.value === 'number',
    })

    const iterations: number[] = []

    await runFuzzIterations(counterSurface, counterGenerator, invariants, {
      iterations: 5,
      baseSeed: 12345,
      onIteration: (i) => {
        iterations.push(i)
      },
    })

    expect(iterations).toEqual([0, 1, 2, 3, 4])
  })
})
