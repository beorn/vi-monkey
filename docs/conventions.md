# Testing Conventions

Recommended patterns for organizing tests with vitestx. These are conventions, not built-in features.

## Infrastructure Selection

Use an environment variable to control test infrastructure (fakes vs real):

```bash
TEST_SYS=fake vitest       # fakes (default, fast)
TEST_SYS=real:mem vitest   # real implementation, in-memory
TEST_SYS=real:disk vitest  # real implementation, disk
```

### Implementation

```typescript
// env.ts (vitestx provides this)
export type TestSys = 'fake' | 'real:mem' | 'real:disk'

export function getTestSys(): TestSys {
  const value = process.env.TEST_SYS
  if (value === 'real:mem' || value === 'real:disk') return value
  return 'fake'
}
```

### Usage in Surfaces

```typescript
import { getTestSys, defineSurface } from 'vitestx'

export const surface = defineSurface({
  create: () => {
    const sys = getTestSys()
    if (sys === 'fake') return createFakeStore()
    if (sys === 'real:mem') return createStore(':memory:')
    return createStore(tempDir())
  },
  // ...
})
```

### Why This Pattern

| Mode | Speed | Isolation | Use Case |
|------|-------|-----------|----------|
| `fake` | Fastest | Perfect | Default iteration |
| `real:mem` | Fast | Good | Integration tests |
| `real:disk` | Slowest | Real | CI drift detection |

**Drift detection**: Periodically run with `real:disk` to catch when fake behavior diverges from real.

## File Naming

| Suffix | Purpose | In fast suite? |
|--------|---------|----------------|
| `.test.ts` | Unit/integration | ✓ |
| `.spec.ts` | Acceptance/fuzz | ✓ |
| `.slow.test.ts` | Slow tests (>1s) | ✗ |
| `.test.md` | CLI tests (mdtest) | ✓ |

**Key insight**: Speed is orthogonal to test level. E2E tests with fakes are fast.

```bash
vitest                           # fast tests (excludes *.slow.*)
vitest run --include='**/*.slow.*'  # slow tests only
```

## Test Organization

### One Source of Truth

Each behavior tested at exactly one level:

```
User-visible behavior → Acceptance test (spec.ts, test.md)
Domain logic          → Core test (test.ts)
Edge cases, crashes   → Unit test (test.ts)
```

Don't duplicate: if `board.spec.ts` tests cursor navigation, no unit test for same logic.

### Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              ACCEPTANCE TESTS                               │
│         (end-user visible, documentation-like)              │
├────────────────────────┬────────────────────────────────────┤
│  VISUAL (TUI)          │  CLI                               │
│  inkx + surface        │  mdtest (.test.md)                 │
│  - Screen coordinates  │  - Command output                  │
│  - Keyboard navigation │  - Error messages                  │
└────────────────────────┴────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              CORE TESTS                                     │
│         (per layer, per domain object)                      │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN TESTS          │  LOGIC TESTS                       │
│  - Repo: CRUD, queries │  - Parser: parse/serialize         │
│  - Board: state        │  - Tree: queries                   │
└─────────────────────────┴───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              EXPLORATION TESTS                              │
├────────────────────────┬────────────────────────────────────┤
│  FUZZ                  │  AI                                │
│  - Random sequences    │  - LLM-driven exploration          │
│  - Property-based      │  - Semantic edge cases             │
│  - Shrinking           │  - Save as regression              │
└────────────────────────┴────────────────────────────────────┘
```

## Fuzz Testing Pattern

### Surface + Actions + Invariants

```typescript
// board.spec.ts

// 1. Surface: how to interact
export const surface = defineSurface({
  create: () => renderBoard(data),
  sendAction: (board, key) => board.press(key),
  getState: (board) => board.getState(),
})

// 2. Actions: what can happen
export const actions = ['j', 'k', 'Enter', 'Escape']

// 3. Invariants: what must hold
export const invariants = defineInvariants({
  singleCursor: (s) => s.cursors.length === 1,
  cursorInBounds: (s) => s.cursor >= 0 && s.cursor < s.items.length,
})
```

### Reproducibility

Always log seed on failure:

```
FAIL board.spec.ts
  Invariant: cursorInBounds
  Seed: 12345
  Reproduce: FUZZ_SEED=12345 vitest fuzz board.spec.ts
```

### Shrinking

vitestx shrinks failing sequences automatically:

```
Original: 47 actions
Shrunk: 3 actions → ['j', 'j', 'h']
```

## Invariant Categories

| Category | Examples |
|----------|----------|
| Structural | No orphan nodes, no duplicate IDs |
| UI | Single cursor, selection visible |
| State | Non-negative balance, valid email |
| Relational | Count matches length, selected in list |

```typescript
export const invariants = defineInvariants({
  // Structural
  noOrphans: (s) => s.nodes.every(n => !n.parentId || s.has(n.parentId)),

  // UI
  singleCursor: (s) => s.queryAll('[data-cursor]').length === 1,

  // State
  nonNegative: (s) => s.balance >= 0,

  // Relational
  countMatches: (s) => s.count === s.items.length,
})
```

## CI Workflow

```bash
# Iteration (fast feedback)
vitest                        # default: fake, fast

# Before commit
vitest run                    # all fast tests
vitest run --include='**/*.slow.*'  # slow tests

# CI (drift detection)
TEST_SYS=real:disk vitest run
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Global singletons `getDb()` | Inject via surface `create()` |
| Real filesystem in fast tests | Use fakes, temp dirs |
| Duplicate tests at multiple levels | One source of truth |
| Time-dependent tests | Inject clock, use fakes |

## See Also

- [getting-started.md](./getting-started.md) - Quick start
- [fuzz-mode.md](./fuzz-mode.md) - Fuzz testing details
- [concepts.md](./concepts.md) - Surface, Generator, Invariant
