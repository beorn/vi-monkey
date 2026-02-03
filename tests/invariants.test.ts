import { describe, test, expect } from 'vitest'
import { defineInvariants, checkInvariants } from '../src/invariants/dsl.js'
import {
  createChecker,
  assertInvariants,
  InvariantViolationError,
} from '../src/invariants/checker.js'

interface TestState {
  value: number
  items: string[]
}

describe('defineInvariants', () => {
  test('creates invariants object', () => {
    const invariants = defineInvariants<TestState>({
      positive: (s) => s.value > 0,
      hasItems: (s) => s.items.length > 0,
    })

    expect(invariants).toHaveProperty('positive')
    expect(invariants).toHaveProperty('hasItems')
  })
})

describe('checkInvariants', () => {
  const invariants = defineInvariants<TestState>({
    positive: (s) => s.value > 0,
    hasItems: (s) => s.items.length > 0,
    maxItems: (s) => {
      if (s.items.length > 10) {
        return `Too many items: ${s.items.length}`
      }
      return true
    },
  })

  test('returns passed=true when all invariants hold', () => {
    const state: TestState = { value: 5, items: ['a', 'b'] }
    const result = checkInvariants(invariants, state)

    expect(result.passed).toBe(true)
    expect(result.firstFailure).toBeUndefined()
  })

  test('returns passed=false with first failure', () => {
    const state: TestState = { value: -1, items: ['a'] }
    const result = checkInvariants(invariants, state)

    expect(result.passed).toBe(false)
    expect(result.firstFailure).toBeDefined()
    expect(result.firstFailure!.name).toBe('positive')
  })

  test('captures custom error message from string return', () => {
    const state: TestState = { value: 5, items: Array(15).fill('x') }
    const result = checkInvariants(invariants, state)

    expect(result.passed).toBe(false)
    expect(result.firstFailure!.name).toBe('maxItems')
    expect(result.firstFailure!.message).toContain('Too many items: 15')
  })

  test('handles invariant that throws', () => {
    const throwingInvariants = defineInvariants<TestState>({
      throws: () => {
        throw new Error('Kaboom!')
      },
    })

    const state: TestState = { value: 1, items: [] }
    const result = checkInvariants(throwingInvariants, state)

    expect(result.passed).toBe(false)
    expect(result.firstFailure!.message).toContain('threw')
    expect(result.firstFailure!.message).toContain('Kaboom!')
  })

  test('includes results for each invariant', () => {
    const state: TestState = { value: 5, items: ['a'] }
    const result = checkInvariants(invariants, state)

    expect(result.results.positive.passed).toBe(true)
    expect(result.results.hasItems.passed).toBe(true)
    expect(result.results.maxItems.passed).toBe(true)
  })
})

describe('createChecker', () => {
  const invariants = defineInvariants<TestState>({
    positive: (s) => s.value > 0,
  })

  test('returns check function', () => {
    const check = createChecker(invariants)
    const result = check({ value: 5, items: [] })

    expect(result.passed).toBe(true)
  })

  test('throwOnFailure throws InvariantViolationError', () => {
    const check = createChecker(invariants, { throwOnFailure: true })

    expect(() => check({ value: -1, items: [] })).toThrow(InvariantViolationError)
  })

  test('does not throw when invariants pass with throwOnFailure', () => {
    const check = createChecker(invariants, { throwOnFailure: true })

    expect(() => check({ value: 5, items: [] })).not.toThrow()
  })
})

describe('assertInvariants', () => {
  const invariants = defineInvariants<TestState>({
    positive: (s) => s.value > 0,
  })

  test('does not throw when invariants pass', () => {
    expect(() => assertInvariants(invariants, { value: 5, items: [] })).not.toThrow()
  })

  test('throws InvariantViolationError on failure', () => {
    expect(() => assertInvariants(invariants, { value: -1, items: [] })).toThrow(
      InvariantViolationError
    )
  })

  test('includes context in error message', () => {
    try {
      assertInvariants(invariants, { value: -1, items: [] }, 'step 42')
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantViolationError)
      expect((e as Error).message).toContain('step 42')
    }
  })

  test('InvariantViolationError includes state', () => {
    const state = { value: -1, items: ['a'] }
    try {
      assertInvariants(invariants, state)
      expect.fail('Should have thrown')
    } catch (e) {
      expect((e as InvariantViolationError).state).toEqual(state)
      expect((e as InvariantViolationError).invariantName).toBe('positive')
    }
  })
})
