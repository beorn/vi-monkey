import { describe, test, expect, vi } from 'vitest'
import { generateTestScenarios, type BatchGenerationOptions } from '../src/ai/batch.js'
import { buildSystemContext } from '../src/ai/introspect.js'
import { defineSurface } from '../src/surfaces/types.js'
import { defineInvariants } from '../src/invariants/dsl.js'

// Simple test surface
const surface = defineSurface({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
  },
  getState: (state) => ({ value: state.value }),
})

const actions = ['inc', 'dec', 'reset'] as const

const invariants = defineInvariants({
  finite: (s: { value: number }) => {
    if (!Number.isFinite(s.value)) return 'Value is not finite'
    return true
  },
})

describe('generateTestScenarios', () => {
  test('generates mock scenarios when VITESTX_AI_MOCK !== "false"', async () => {
    const context = buildSystemContext(surface, actions, invariants)

    const result = await generateTestScenarios(context, {
      count: 5,
      maxActionsPerScenario: 10,
    })

    expect(result.scenarios).toHaveLength(5)
    expect(result.model).toBe('mock')
    expect(result.tokensUsed).toBe(0)
  })

  test('each scenario has required fields', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context, { count: 3 })

    for (const scenario of result.scenarios) {
      expect(scenario.name).toBeDefined()
      expect(scenario.description).toBeDefined()
      expect(Array.isArray(scenario.actions)).toBe(true)
      expect(scenario.reasoning).toBeDefined()
      expect(scenario.expectation).toBeDefined()
    }
  })

  test('scenarios use valid actions only', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context, { count: 5 })

    const validActions = new Set(actions)

    for (const scenario of result.scenarios) {
      for (const action of scenario.actions) {
        expect(validActions.has(action as (typeof actions)[number])).toBe(true)
      }
    }
  })

  test('respects maxActionsPerScenario', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context, {
      count: 5,
      maxActionsPerScenario: 5,
    })

    for (const scenario of result.scenarios) {
      expect(scenario.actions.length).toBeLessThanOrEqual(5)
    }
  })

  test('generates diverse scenarios', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context, { count: 5 })

    // Check that scenarios have different names/descriptions
    const names = new Set(result.scenarios.map((s) => s.name))
    expect(names.size).toBeGreaterThan(1)
  })

  test('mock scenarios include different patterns', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context, {
      count: 5,
      maxActionsPerScenario: 20,
    })

    // Mock generates patterns: repeated, all once, alternating, reverse, mix
    const descriptions = result.scenarios.map((s) => s.description)

    // At least some variety in patterns
    const patterns = descriptions.filter(
      (d) =>
        d.includes('repeated') ||
        d.includes('once') ||
        d.includes('alternating') ||
        d.includes('reverse') ||
        d.includes('mix')
    )
    expect(patterns.length).toBeGreaterThan(0)
  })
})

describe('batch generation options', () => {
  test('uses default options when not specified', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context)

    // Default count is 10
    expect(result.scenarios.length).toBeLessThanOrEqual(10)
  })

  test('merges partial options with defaults', async () => {
    const context = buildSystemContext(surface, actions, invariants)
    const result = await generateTestScenarios(context, { count: 3 })

    expect(result.scenarios).toHaveLength(3)
    // maxActionsPerScenario should use default (20)
    for (const scenario of result.scenarios) {
      expect(scenario.actions.length).toBeLessThanOrEqual(20)
    }
  })
})
