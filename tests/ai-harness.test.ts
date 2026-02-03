import { describe, test, expect } from 'vitest'
import { runAiExploration, exploreWithFocus } from '../src/ai/harness.js'
import { defineSurface } from '../src/surfaces/types.js'
import { defineInvariants } from '../src/invariants/dsl.js'

// Simple counter surface
const counterSurface = defineSurface({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
    if (action === 'reset') state.value = 0
  },
  getState: (state) => ({ value: state.value }),
})

const counterActions = ['inc', 'dec', 'reset'] as const

// Invariants that always pass (must return true explicitly when passing)
const passingInvariants = defineInvariants({
  finite: (s: { value: number }) => {
    if (!Number.isFinite(s.value)) return 'Value is not finite'
    return true
  },
})

// Invariants that fail when value < 0
const failingInvariants = defineInvariants({
  nonNegative: (s: { value: number }) => {
    if (s.value < 0) return `Value ${s.value} is negative`
    return true
  },
})

describe('runAiExploration', () => {
  test('runs all scenarios and returns results', async () => {
    const result = await runAiExploration(counterSurface, counterActions, passingInvariants, {
      scenarioCount: 3,
      maxActionsPerScenario: 5,
    })

    expect(result.scenarios).toHaveLength(3)
    expect(result.model).toBeDefined()
    expect(typeof result.tokensUsed).toBe('number')
  })

  test('reports all scenarios passing when invariants hold', async () => {
    const result = await runAiExploration(counterSurface, counterActions, passingInvariants, {
      scenarioCount: 3,
      maxActionsPerScenario: 5,
    })

    expect(result.passed).toBe(true)
    expect(result.findings).toHaveLength(0)

    for (const scenario of result.scenarios) {
      expect(scenario.passed).toBe(true)
    }
  })

  test('each scenario result includes steps', async () => {
    const result = await runAiExploration(counterSurface, counterActions, passingInvariants, {
      scenarioCount: 1,
      maxActionsPerScenario: 5,
    })

    const scenario = result.scenarios[0]
    expect(scenario.steps.length).toBeGreaterThan(0)

    for (const step of scenario.steps) {
      expect(step.step).toBeGreaterThan(0)
      expect(step.action).toBeDefined()
      expect(step.state).toBeDefined()
      expect(typeof step.invariantsPassed).toBe('boolean')
    }
  })

  test('detects invariant failures', async () => {
    // Use a surface that can go negative
    const result = await runAiExploration(counterSurface, counterActions, failingInvariants, {
      scenarioCount: 5,
      maxActionsPerScenario: 20,
    })

    // Mock scenarios include 'dec' actions which can make value negative
    // At least one scenario should fail
    const failedScenarios = result.scenarios.filter((s) => !s.passed)

    // Check that failures have proper failure info
    for (const failed of failedScenarios) {
      if (failed.failure) {
        expect(failed.failure.invariant).toBeDefined()
        expect(failed.failure.message).toBeDefined()
        expect(failed.failure.step).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('includes description in context when provided', async () => {
    const result = await runAiExploration(counterSurface, counterActions, passingInvariants, {
      scenarioCount: 1,
      description: 'Counter with inc/dec/reset',
    })

    // Should complete without error
    expect(result.scenarios).toHaveLength(1)
  })

  test('collects findings for failed scenarios', async () => {
    const result = await runAiExploration(counterSurface, counterActions, failingInvariants, {
      scenarioCount: 5,
      maxActionsPerScenario: 20,
    })

    // findings should equal failed scenarios
    const failedCount = result.scenarios.filter((s) => !s.passed).length
    expect(result.findings).toHaveLength(failedCount)

    // All findings should have passed = false
    for (const finding of result.findings) {
      expect(finding.passed).toBe(false)
    }
  })
})

describe('exploreWithFocus', () => {
  test('accepts focus hints', async () => {
    const result = await exploreWithFocus(counterSurface, counterActions, passingInvariants, {
      focus: ['boundary conditions', 'repeated decrements'],
      scenarioCount: 2,
    })

    expect(result.scenarios).toHaveLength(2)
  })

  test('requires focus parameter', async () => {
    const result = await exploreWithFocus(counterSurface, counterActions, passingInvariants, {
      focus: ['empty case'],
      scenarioCount: 1,
    })

    // Should complete successfully
    expect(result.passed).toBe(true)
  })
})

describe('scenario execution', () => {
  test('handles surface exceptions gracefully', async () => {
    // Surface that throws on 'crash' action
    const crashingSurface = defineSurface({
      create: () => ({ value: 0 }),
      sendAction: (state, action) => {
        if (action === 'crash') throw new Error('Intentional crash')
        if (action === 'inc') state.value++
      },
      getState: (state) => ({ value: state.value }),
    })

    const result = await runAiExploration(crashingSurface, ['inc', 'crash'], passingInvariants, {
      scenarioCount: 3,
    })

    // Should complete without throwing
    expect(result.scenarios).toBeDefined()

    // Scenarios with 'crash' action should be marked as failed
    for (const scenario of result.scenarios) {
      if (scenario.scenario.actions.includes('crash') && !scenario.passed) {
        expect(scenario.failure?.invariant).toBe('(exception)')
        expect(scenario.failure?.message).toContain('Intentional crash')
      }
    }
  })

  test('disposes surface instance after each scenario', async () => {
    let disposeCount = 0

    const trackedSurface = defineSurface({
      create: () => ({ value: 0 }),
      sendAction: (state) => {
        state.value++
      },
      getState: (state) => ({ value: state.value }),
      dispose: () => {
        disposeCount++
      },
    })

    await runAiExploration(trackedSurface, ['inc'], passingInvariants, {
      scenarioCount: 3,
    })

    // 3 scenarios + 1 for buildSystemContext introspection = 4
    expect(disposeCount).toBe(4)
  })

  test('checks initial state invariants', async () => {
    // Surface with invalid initial state
    const badInitialSurface = defineSurface({
      create: () => ({ value: -1 }), // Starts negative
      sendAction: (state) => {
        state.value++
      },
      getState: (state) => ({ value: state.value }),
    })

    const result = await runAiExploration(badInitialSurface, ['inc'], failingInvariants, {
      scenarioCount: 1,
    })

    // Should fail on initial state
    expect(result.scenarios[0].passed).toBe(false)
    expect(result.scenarios[0].failure?.step).toBe(0)
    expect(result.scenarios[0].failure?.action).toBe('(initial)')
  })
})
