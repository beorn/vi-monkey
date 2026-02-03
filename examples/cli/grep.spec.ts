/**
 * CLI Grep Example
 *
 * Demonstrates vitestx surface for CLI command testing.
 */

import { test, expect } from 'vitest'
import { defineSurface, defineGenerator, defineInvariants } from '../../src/index.js'

// Mock CLI state (in real usage, would execute actual commands)
interface CliState {
  args: string[]
  env: Record<string, string>
  stdin: string
  stdout: string
  stderr: string
  exitCode: number | null
}

interface CliAction {
  type: 'arg' | 'env' | 'stdin' | 'run'
  value?: string
  key?: string
}

function createCli(): CliState {
  return {
    args: [],
    env: {},
    stdin: '',
    stdout: '',
    stderr: '',
    exitCode: null,
  }
}

// Mock grep implementation for example
function mockGrep(state: CliState): void {
  const pattern = state.args[0]
  const input = state.stdin

  if (!pattern) {
    state.stderr = 'grep: no pattern specified'
    state.exitCode = 2
    return
  }

  try {
    const regex = new RegExp(pattern, state.args.includes('-i') ? 'i' : '')
    const lines = input.split('\n')
    const matches = lines.filter((line) => regex.test(line))

    if (state.args.includes('-c')) {
      state.stdout = String(matches.length)
    } else if (state.args.includes('-l')) {
      state.stdout = matches.length > 0 ? 'stdin' : ''
    } else {
      state.stdout = matches.join('\n')
    }

    state.exitCode = matches.length > 0 ? 0 : 1
  } catch {
    state.stderr = `grep: invalid pattern "${pattern}"`
    state.exitCode = 2
  }
}

// --- vitestx exports ---

export const surface = defineSurface({
  create: () => createCli(),

  sendAction: (state, action: CliAction) => {
    switch (action.type) {
      case 'arg':
        if (action.value) state.args.push(action.value)
        break
      case 'env':
        if (action.key && action.value) state.env[action.key] = action.value
        break
      case 'stdin':
        if (action.value) state.stdin = action.value
        break
      case 'run':
        mockGrep(state)
        break
    }
  },

  getState: (state) => ({ ...state }),

  query: () => [],
})

export const actions: CliAction[] = [
  { type: 'arg', value: 'hello' },
  { type: 'arg', value: 'world' },
  { type: 'arg', value: '-i' },
  { type: 'arg', value: '-c' },
  { type: 'arg', value: '-l' },
  { type: 'stdin', value: 'hello world\nHELLO WORLD\ngoodbye' },
  { type: 'stdin', value: '' },
  { type: 'run' },
]

export const invariants = defineInvariants<CliState>({
  // Exit code is null before run, number after
  exitCodeValid: (state) => {
    if (state.exitCode !== null && typeof state.exitCode !== 'number') {
      return 'Exit code must be null or number'
    }
    return true
  },

  // stderr only has content on error
  stderrImpliesError: (state) => {
    if (state.stderr && state.exitCode === 0) {
      return 'stderr should be empty when exitCode is 0'
    }
    return true
  },

  // stdout and stderr are strings
  outputsAreStrings: (state) => {
    if (typeof state.stdout !== 'string') return 'stdout must be string'
    if (typeof state.stderr !== 'string') return 'stderr must be string'
    return true
  },
})

export const generator = defineGenerator({
  actions,
  weights: {
    // Can't use object keys for complex actions, use generate instead
  },
  maxSteps: 20,
  generate(random) {
    return random.pick(this.actions)
  },
})

export const description = `
A grep-like CLI command.
- Add arguments with 'arg' actions
- Set stdin with 'stdin' action
- Execute with 'run' action
- Check stdout, stderr, exitCode

Flags: -i (ignore case), -c (count), -l (files with matches)
`

// --- Hand-written tests ---

test('grep finds matching lines', () => {
  const cli = surface.create()

  surface.sendAction(cli, { type: 'arg', value: 'hello' })
  surface.sendAction(cli, { type: 'stdin', value: 'hello world\ngoodbye' })
  surface.sendAction(cli, { type: 'run' })

  const state = surface.getState(cli)
  expect(state.stdout).toBe('hello world')
  expect(state.exitCode).toBe(0)
})

test('grep returns exit code 1 when no match', () => {
  const cli = surface.create()

  surface.sendAction(cli, { type: 'arg', value: 'notfound' })
  surface.sendAction(cli, { type: 'stdin', value: 'hello world' })
  surface.sendAction(cli, { type: 'run' })

  const state = surface.getState(cli)
  expect(state.stdout).toBe('')
  expect(state.exitCode).toBe(1)
})

test('grep -i ignores case', () => {
  const cli = surface.create()

  surface.sendAction(cli, { type: 'arg', value: 'hello' })
  surface.sendAction(cli, { type: 'arg', value: '-i' })
  surface.sendAction(cli, { type: 'stdin', value: 'HELLO world\ngoodbye' })
  surface.sendAction(cli, { type: 'run' })

  const state = surface.getState(cli)
  expect(state.stdout).toBe('HELLO world')
  expect(state.exitCode).toBe(0)
})

test('grep -c counts matches', () => {
  const cli = surface.create()

  surface.sendAction(cli, { type: 'arg', value: 'o' })
  surface.sendAction(cli, { type: 'arg', value: '-c' })
  surface.sendAction(cli, { type: 'stdin', value: 'hello\nworld\nfoo' })
  surface.sendAction(cli, { type: 'run' })

  const state = surface.getState(cli)
  expect(state.stdout).toBe('3')
})

test('grep errors without pattern', () => {
  const cli = surface.create()

  surface.sendAction(cli, { type: 'stdin', value: 'hello' })
  surface.sendAction(cli, { type: 'run' })

  const state = surface.getState(cli)
  expect(state.stderr).toContain('no pattern')
  expect(state.exitCode).toBe(2)
})
