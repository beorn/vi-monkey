/**
 * TUI Board Example
 *
 * Demonstrates vitestx surface, generator, and invariants for a TUI component.
 */

import { test, expect } from 'vitest'
import { defineSurface, defineGenerator, defineInvariants } from '../../src/index.js'

// Mock board implementation for example
interface BoardState {
  cursor: number
  items: { id: string; text: string }[]
  selected: string | null
}

interface BoardInstance {
  state: BoardState
  press(key: string): void
  getState(): BoardState
  query(selector: string): Array<{ dataset: Record<string, string> }>
  queryAll(selector: string): Array<{ dataset: Record<string, string> }>
}

function createBoard(items: string[]): BoardInstance {
  const state: BoardState = {
    cursor: 0,
    items: items.map((text, i) => ({ id: `item-${i}`, text })),
    selected: null,
  }

  return {
    state,

    press(key: string) {
      switch (key) {
        case 'j':
          if (state.cursor < state.items.length - 1) state.cursor++
          break
        case 'k':
          if (state.cursor > 0) state.cursor--
          break
        case 'Enter':
          state.selected = state.items[state.cursor]?.id ?? null
          break
        case 'Escape':
          state.selected = null
          break
      }
    },

    getState() {
      return { ...state }
    },

    query(selector: string) {
      if (selector === '[data-cursor]') {
        return [{ dataset: { cursor: 'true', index: String(state.cursor) } }]
      }
      if (selector === '[data-selected]' && state.selected) {
        return [{ dataset: { selected: state.selected } }]
      }
      return []
    },

    queryAll(selector: string) {
      return this.query(selector)
    },
  }
}

// --- vitestx exports ---

/**
 * Surface definition for the board
 */
export const surface = defineSurface({
  create: () => createBoard(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5']),

  sendAction: (board, key: string) => {
    board.press(key)
  },

  getState: (board) => board.getState(),

  query: (board, selector) =>
    board.queryAll(selector).map((el) => ({
      type: 'div',
      props: {},
      children: [],
      dataset: el.dataset,
      textContent: '',
    })),

  dispose: () => {
    // No cleanup needed for this simple example
  },
})

/**
 * Available actions
 */
export const actions = ['j', 'k', 'Enter', 'Escape'] as const

/**
 * Invariants that must always hold
 */
export const invariants = defineInvariants<BoardState>({
  // There is always exactly one cursor
  singleCursor: () => true, // Implicit in our implementation

  // Cursor is always within bounds
  cursorInBounds: (state) => {
    if (state.cursor < 0) {
      return `Cursor ${state.cursor} is negative`
    }
    if (state.cursor >= state.items.length) {
      return `Cursor ${state.cursor} exceeds items length ${state.items.length}`
    }
    return true
  },

  // If something is selected, it exists in items
  selectedExists: (state) => {
    if (state.selected && !state.items.some((i) => i.id === state.selected)) {
      return `Selected item ${state.selected} not in items`
    }
    return true
  },

  // Items always have unique IDs
  uniqueIds: (state) => {
    const ids = state.items.map((i) => i.id)
    const unique = new Set(ids)
    if (ids.length !== unique.size) {
      return 'Duplicate item IDs found'
    }
    return true
  },
})

/**
 * Generator for fuzz testing
 */
export const generator = defineGenerator({
  actions,
  weights: {
    j: 10, // Navigation is most common
    k: 10,
    Enter: 3, // Selection less common
    Escape: 2, // Deselection rare
  },
  maxSteps: 100,
})

/**
 * Description for AI mode
 */
export const description = `
A simple keyboard-navigable board with 5 items.
- j: Move cursor down
- k: Move cursor up
- Enter: Select current item
- Escape: Deselect

The cursor should always stay within bounds [0, 4].
`

// --- Hand-written tests ---

test('cursor moves down with j', () => {
  const board = surface.create()
  expect(surface.getState(board).cursor).toBe(0)

  surface.sendAction(board, 'j')
  expect(surface.getState(board).cursor).toBe(1)

  surface.sendAction(board, 'j')
  expect(surface.getState(board).cursor).toBe(2)
})

test('cursor moves up with k', () => {
  const board = surface.create()
  surface.sendAction(board, 'j')
  surface.sendAction(board, 'j')
  expect(surface.getState(board).cursor).toBe(2)

  surface.sendAction(board, 'k')
  expect(surface.getState(board).cursor).toBe(1)
})

test('cursor stays at top boundary', () => {
  const board = surface.create()
  expect(surface.getState(board).cursor).toBe(0)

  surface.sendAction(board, 'k')
  expect(surface.getState(board).cursor).toBe(0)

  surface.sendAction(board, 'k')
  expect(surface.getState(board).cursor).toBe(0)
})

test('cursor stays at bottom boundary', () => {
  const board = surface.create()

  // Move to bottom
  for (let i = 0; i < 10; i++) {
    surface.sendAction(board, 'j')
  }

  expect(surface.getState(board).cursor).toBe(4) // 5 items, max index is 4
})

test('Enter selects current item', () => {
  const board = surface.create()
  surface.sendAction(board, 'j')
  surface.sendAction(board, 'Enter')

  const state = surface.getState(board)
  expect(state.selected).toBe('item-1')
})

test('Escape deselects', () => {
  const board = surface.create()
  surface.sendAction(board, 'Enter')
  expect(surface.getState(board).selected).toBe('item-0')

  surface.sendAction(board, 'Escape')
  expect(surface.getState(board).selected).toBeNull()
})
