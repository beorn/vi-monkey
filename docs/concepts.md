# Core Concepts

vitestx is built around three core abstractions: **Surface**, **Generator**, and **Invariant**.

## Surface

A Surface is the unified interface for the thing under test. Whether you're testing a TUI, CLI, or API, you interact with it through the same interface.

```typescript
interface Surface<State, Action, Instance = unknown> {
  create(): Instance                                    // required
  sendAction(instance: Instance, action: Action): void  // required
  getState(instance: Instance): State                   // required
  query?(instance: Instance, selector: string): Element[]  // optional, for UI
  dispose?(instance: Instance): void                    // optional, cleanup
}
```

### Why "Surface"?

The term comes from the idea of a "test surface" - the interface through which tests interact with the system. Just as a physical surface is what you touch and interact with, the Surface abstraction is what tests touch and interact with.

### TUI Surface Example

```typescript
import { defineSurface } from 'vitestx'
import { render } from 'inkx/testing'
import { Board } from './board'

export const surface = defineSurface({
  create: () => render(<Board data={SAMPLE_DATA} />),

  sendAction: (board, key) => {
    board.press(key)
  },

  getState: (board) => ({
    cursor: board.query('[data-cursor]')?.dataset,
    items: board.queryAll('[data-item]').length,
  }),

  query: (board, selector) => board.queryAll(selector),

  dispose: (board) => board.unmount(),
})
```

### CLI Surface Example

```typescript
import { defineSurface } from 'vitestx'
import { spawnSync } from 'child_process'

export const surface = defineSurface({
  create: () => ({
    args: [],
    env: {},
    output: '',
    exitCode: null,
  }),

  sendAction: (state, action) => {
    if (action.type === 'arg') state.args.push(action.value)
    if (action.type === 'env') state.env[action.key] = action.value
    if (action.type === 'run') {
      const result = spawnSync('mycommand', state.args, { env: state.env })
      state.output = result.stdout.toString()
      state.exitCode = result.status
    }
  },

  getState: (state) => state,
  // query and dispose are optional - omitted here
})
```

### API Surface Example

```typescript
import { defineSurface } from 'vitestx'

export const surface = defineSurface({
  create: () => ({
    baseUrl: 'http://localhost:3000',
    headers: {},
    lastResponse: null,
  }),

  sendAction: async (state, action) => {
    if (action.type === 'header') {
      state.headers[action.key] = action.value
    }
    if (action.type === 'request') {
      state.lastResponse = await fetch(`${state.baseUrl}${action.path}`, {
        method: action.method,
        headers: state.headers,
        body: action.body,
      })
    }
  },

  getState: (state) => state,
})
```

## Generator

A Generator defines how to randomly generate action sequences for fuzz testing.

```typescript
interface Generator<Action> {
  actions: Action[]                                   // required
  weights?: Record<Action, number>                    // optional, defaults uniform
  maxSteps?: number                                   // optional, default 100
  generate?(random: SeededRandom, state: unknown): Action  // optional, custom logic
}
```

### Basic Generator

```typescript
import { defineGenerator } from 'vitestx'

export const generator = defineGenerator({
  actions: ['j', 'k', 'h', 'l', 'Enter', 'Escape'],
  maxSteps: 100,
})
```

### Weighted Generator

Weights control how often each action is selected. Higher weight = more likely.

```typescript
export const generator = defineGenerator({
  actions: ['j', 'k', 'h', 'l', 'Enter', 'Escape'],
  weights: {
    j: 10,      // navigation is common
    k: 10,
    h: 5,
    l: 5,
    Enter: 3,   // selection is less common
    Escape: 1,  // escape is rare
  },
  maxSteps: 100,
})
```

### State-Dependent Generator

For complex scenarios, generate actions based on current state:

```typescript
export const generator = defineGenerator({
  actions: ['move', 'attack', 'heal', 'wait'],

  generate(random, state) {
    // If health is low, prefer healing
    if (state.health < 20) {
      return random.pick(['heal', 'heal', 'heal', 'wait'])
    }
    // If enemy nearby, prefer attack
    if (state.enemyDistance < 2) {
      return random.pick(['attack', 'attack', 'move'])
    }
    // Otherwise, explore
    return random.pick(this.actions)
  },

  maxSteps: 200,
})
```

## Invariant

Invariants are properties that must hold after every action. They define correctness.

```typescript
type Invariant<State> = (state: State) => boolean | string

interface Invariants<State> {
  [name: string]: Invariant<State>
}
```

### Defining Invariants

```typescript
import { defineInvariants } from 'vitestx'

export const invariants = defineInvariants({
  // Return boolean: true = pass, false = fail
  singleCursor: (state) =>
    state.queryAll('[data-cursor]').length === 1,

  // Return string for custom error message
  validRange: (state) => {
    if (state.value < 0) return `Value ${state.value} is negative`
    if (state.value > 100) return `Value ${state.value} exceeds max`
    return true
  },

  // Complex invariants
  treeStructure: (state) => {
    // Every node's parent exists (except root)
    for (const node of state.nodes) {
      if (node.parentId && !state.nodeMap.has(node.parentId)) {
        return `Node ${node.id} has missing parent ${node.parentId}`
      }
    }
    return true
  },
})
```

### Invariant Categories

Common invariant patterns:

**Structural Invariants** - Data structure integrity
```typescript
noOrphanNodes: (s) => s.nodes.every(n => !n.parentId || s.has(n.parentId)),
noDuplicateIds: (s) => new Set(s.ids).size === s.ids.length,
```

**UI Invariants** - Visual consistency
```typescript
singleCursor: (s) => s.queryAll('[data-cursor]').length === 1,
visibleSelection: (s) => !s.selectedId || s.query(`[data-id="${s.selectedId}"]`),
```

**State Invariants** - Business logic
```typescript
nonNegativeBalance: (s) => s.balance >= 0,
validEmail: (s) => !s.email || s.email.includes('@'),
```

**Relational Invariants** - Consistency between fields
```typescript
countMatchesLength: (s) => s.count === s.items.length,
selectedInList: (s) => !s.selectedId || s.items.includes(s.selectedId),
```

## How They Work Together

1. **Surface** defines how to interact with your system
2. **Generator** produces random action sequences
3. **Invariants** verify correctness after each action

```
┌─────────────────────────────────────────────────────────────┐
│                      Fuzz Test Loop                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   seed ──► Generator ──► action ──► Surface ──► state       │
│                │                                   │        │
│                │                                   ▼        │
│                │                            Invariants      │
│                │                                   │        │
│                │         ┌──── pass ◄─────────────┤        │
│                │         │                         │        │
│                ▼         ▼                         │        │
│            repeat ◄── continue                   fail       │
│                                                    │        │
│                                                    ▼        │
│                                              shrink + report│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure Selection (Convention)

vitestx provides `getTestSys()` to support a recommended convention for switching between fakes and real implementations:

```typescript
import { getTestSys } from 'vitestx'

export const surface = defineSurface({
  create: () => {
    const sys = getTestSys()  // reads TEST_SYS env var
    if (sys === 'fake') return createFakeStore()
    if (sys === 'real:mem') return createStore(':memory:')
    return createStore(tempDir())
  },
  // ...
})
```

```bash
TEST_SYS=fake vitest       # fakes (default, fast)
TEST_SYS=real:mem vitest   # real, in-memory
TEST_SYS=real:disk vitest  # real, disk (drift detection)
```

See [conventions.md](./conventions.md) for the full testing conventions guide.
