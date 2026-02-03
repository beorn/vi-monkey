import { describe, test, expect } from 'vitest'
import {
  createRandomChooser,
  createReplayChooser,
  createAiChooser,
  runWithChooser,
} from '../src/chooser/index.js'
import { defineGenerator } from '../src/fuzz/generator.js'
import { defineSurface } from '../src/surfaces/types.js'
import { createSeededRandom } from '../src/random.js'

const surface = defineSurface({
  create: () => ({ value: 0 }),
  sendAction: (state, action) => {
    if (action === 'inc') state.value++
    if (action === 'dec') state.value--
  },
  getState: (state) => ({ value: state.value }),
})

describe('createRandomChooser', () => {
  test('chooses from generator actions', () => {
    const generator = defineGenerator({
      actions: ['inc', 'dec'] as const,
    })
    const random = createSeededRandom(12345)
    const chooser = createRandomChooser(generator, random)

    expect(chooser.name).toBe('random')

    const actions = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const action = chooser.choose({ value: 0 })
      if (action) actions.add(action)
    }

    expect(actions.has('inc')).toBe(true)
    expect(actions.has('dec')).toBe(true)
  })
})

describe('createReplayChooser', () => {
  test('plays back fixed sequence', () => {
    const chooser = createReplayChooser(['a', 'b', 'c'])

    expect(chooser.name).toBe('replay')
    expect(chooser.choose({})).toBe('a')
    expect(chooser.choose({})).toBe('b')
    expect(chooser.choose({})).toBe('c')
    expect(chooser.choose({})).toBe(null) // exhausted
  })

  test('reset restarts sequence', () => {
    const chooser = createReplayChooser(['x', 'y'])

    expect(chooser.choose({})).toBe('x')
    expect(chooser.choose({})).toBe('y')
    expect(chooser.choose({})).toBe(null)

    chooser.reset!()
    expect(chooser.choose({})).toBe('x')
  })
})

describe('createAiChooser', () => {
  test('cycles through available actions (stub)', async () => {
    const chooser = createAiChooser({
      model: 'test-model',
      temperature: 0,
      availableActions: ['a', 'b', 'c'],
    })

    expect(chooser.name).toBe('ai:test-model')

    expect(await chooser.choose({})).toBe('a')
    expect(await chooser.choose({})).toBe('b')
    expect(await chooser.choose({})).toBe('c')
    expect(await chooser.choose({})).toBe('a') // cycles
  })

  test('returns null with no actions', async () => {
    const chooser = createAiChooser({
      model: 'empty',
      temperature: 0,
      availableActions: [],
    })

    expect(await chooser.choose({})).toBe(null)
  })
})

describe('runWithChooser', () => {
  test('executes actions from chooser', async () => {
    const chooser = createReplayChooser(['inc', 'inc', 'dec'] as const)

    const result = await runWithChooser(surface, {
      chooser,
      maxSteps: 10,
    })

    expect(result.actions).toEqual(['inc', 'inc', 'dec'])
    expect(result.steps).toBe(3)
    expect(result.stalled).toBe(true) // sequence exhausted
  })

  test('stops at maxSteps', async () => {
    const generator = defineGenerator({
      actions: ['inc'] as const,
    })
    const random = createSeededRandom(12345)
    const chooser = createRandomChooser(generator, random)

    const result = await runWithChooser(surface, {
      chooser,
      maxSteps: 5,
    })

    expect(result.actions).toHaveLength(5)
    expect(result.steps).toBe(5)
    expect(result.stalled).toBe(false)
  })

  test('calls onStep callback', async () => {
    const chooser = createReplayChooser(['inc', 'dec'] as const)
    const steps: { step: number; action: string }[] = []

    await runWithChooser(surface, {
      chooser,
      maxSteps: 10,
      onStep: (step, action) => steps.push({ step, action }),
    })

    expect(steps).toEqual([
      { step: 1, action: 'inc' },
      { step: 2, action: 'dec' },
    ])
  })
})
