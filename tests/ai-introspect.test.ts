import { describe, test, expect } from 'vitest'
import { buildSystemContext, formatContextForLLM } from '../src/ai/introspect.js'
import { defineSurface } from '../src/surfaces/types.js'
import { defineInvariants } from '../src/invariants/dsl.js'
import { defineGenerator } from '../src/fuzz/generator.js'

const surface = defineSurface({
  create: () => ({ count: 0, items: ['a', 'b', 'c'] }),
  sendAction: (state, action) => {
    if (action === 'inc') state.count++
    if (action === 'dec') state.count--
    if (action === 'push') state.items.push('x')
    if (action === 'pop') state.items.pop()
  },
  getState: (state) => ({ count: state.count, items: [...state.items] }),
})

const actions = ['inc', 'dec', 'push', 'pop'] as const

const invariants = defineInvariants({
  countNonNegative: (s: { count: number }) => {
    if (s.count < 0) return `Count ${s.count} is negative`
    return true
  },
  itemsNotEmpty: (s: { items: string[] }) => {
    if (s.items.length === 0) return 'Items array is empty'
    return true
  },
})

describe('buildSystemContext', () => {
  test('extracts actions', () => {
    const context = buildSystemContext(surface, actions, invariants)

    expect(context.actions).toHaveLength(4)
    expect(context.actions.map((a) => a.name)).toEqual(['inc', 'dec', 'push', 'pop'])
  })

  test('extracts invariants', () => {
    const context = buildSystemContext(surface, actions, invariants)

    expect(context.invariants).toHaveLength(2)
    expect(context.invariants.map((i) => i.name)).toContain('countNonNegative')
    expect(context.invariants.map((i) => i.name)).toContain('itemsNotEmpty')
  })

  test('captures initial state', () => {
    const context = buildSystemContext(surface, actions, invariants)

    expect(context.initialState).toEqual({ count: 0, items: ['a', 'b', 'c'] })
  })

  test('infers state shape', () => {
    const context = buildSystemContext(surface, actions, invariants)

    expect(context.stateShape).toEqual({
      type: 'object',
      properties: {
        count: { type: 'number' },
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    })
  })

  test('includes description when provided', () => {
    const context = buildSystemContext(surface, actions, invariants, {
      description: 'Counter with items',
    })

    expect(context.description).toBe('Counter with items')
  })

  test('includes focus when provided', () => {
    const context = buildSystemContext(surface, actions, invariants, {
      focus: ['boundary conditions', 'rapid actions'],
    })

    expect(context.focus).toEqual(['boundary conditions', 'rapid actions'])
  })

  test('includes generator weights when provided', () => {
    const generator = defineGenerator({
      actions: [...actions],
      weights: { inc: 10, dec: 5, push: 2, pop: 1 },
    })

    const context = buildSystemContext(surface, actions, invariants, { generator })

    const incAction = context.actions.find((a) => a.name === 'inc')
    const decAction = context.actions.find((a) => a.name === 'dec')

    expect(incAction?.weight).toBe(10)
    expect(decAction?.weight).toBe(5)
  })

  test('extracts invariant descriptions from return strings', () => {
    const context = buildSystemContext(surface, actions, invariants)

    const countInv = context.invariants.find((i) => i.name === 'countNonNegative')
    // The function returns template literal with value, should extract pattern
    expect(countInv?.description).toContain('Count')
  })
})

describe('formatContextForLLM', () => {
  test('includes all sections', () => {
    const context = buildSystemContext(surface, actions, invariants, {
      description: 'Test system',
    })

    const formatted = formatContextForLLM(context)

    expect(formatted).toContain('# System Under Test')
    expect(formatted).toContain('Test system')
    expect(formatted).toContain('## Available Actions')
    expect(formatted).toContain('`inc`')
    expect(formatted).toContain('## Invariants')
    expect(formatted).toContain('countNonNegative')
    expect(formatted).toContain('## State Shape')
    expect(formatted).toContain('## Initial State')
  })

  test('includes focus section when provided', () => {
    const context = buildSystemContext(surface, actions, invariants, {
      focus: ['empty state', 'negative numbers'],
    })

    const formatted = formatContextForLLM(context)

    expect(formatted).toContain('## Exploration Focus')
    expect(formatted).toContain('empty state')
    expect(formatted).toContain('negative numbers')
  })

  test('omits focus section when not provided', () => {
    const context = buildSystemContext(surface, actions, invariants)
    const formatted = formatContextForLLM(context)

    expect(formatted).not.toContain('## Exploration Focus')
  })

  test('includes weights for actions when present', () => {
    const generator = defineGenerator({
      actions: [...actions],
      weights: { inc: 10 },
    })

    const context = buildSystemContext(surface, actions, invariants, { generator })
    const formatted = formatContextForLLM(context)

    expect(formatted).toContain('(weight: 10)')
  })
})
