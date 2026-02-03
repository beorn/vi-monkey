# Fuzz Mode

Fuzz testing generates random action sequences to find edge cases your hand-written tests miss.

## Quick Start

```bash
vitest fuzz                      # all specs with generators
vitest fuzz board.spec.ts        # specific file
FUZZ_SEED=12345 vitest fuzz      # reproducible
FUZZ_ITERATIONS=1000 vitest fuzz # more iterations
```

## How It Works

1. **Create** a surface instance
2. **Generate** a random action using the seeded RNG
3. **Execute** the action via `surface.sendAction()`
4. **Check** all invariants against the new state
5. **Repeat** until maxSteps or failure
6. **Shrink** failing sequences to minimal reproduction

```
seed: 12345
┌────────────────────────────────────────────────────┐
│ Step 1: action='j'     state={cursor:1}     ✓ pass │
│ Step 2: action='k'     state={cursor:0}     ✓ pass │
│ Step 3: action='Enter' state={selected:0}   ✓ pass │
│ Step 4: action='j'     state={cursor:1}     ✓ pass │
│ ...                                                │
│ Step 47: action='h'    state={cursor:-1}    ✗ FAIL │
└────────────────────────────────────────────────────┘
       │
       ▼
   Shrinking...
       │
       ▼
   Minimal: ['j', 'j', 'h'] (3 steps)
```

## Configuration

### Vitest Config

```typescript
// vitest.config.ts
import { vitestx } from 'vitestx/plugin'

export default defineConfig({
  plugins: [
    vitestx({
      fuzz: {
        // Number of actions per test run
        iterations: 100,

        // Seed source: 'env' reads FUZZ_SEED, 'random' generates new
        seed: 'env',

        // Stop after first failure (vs collect all)
        failFast: true,

        // Shrinking settings
        shrink: {
          enabled: true,
          maxAttempts: 100,
        },
      },
    })
  ]
})
```

### Environment Variables

```bash
# Seed for reproducibility
FUZZ_SEED=12345

# Override iteration count
FUZZ_ITERATIONS=1000

# Disable shrinking (faster, but longer repro)
FUZZ_SHRINK=false
```

## Writing Effective Generators

### Weight Distribution

Weights should reflect realistic usage patterns:

```typescript
// Good: reflects actual user behavior
export const generator = defineGenerator({
  actions: ['scroll', 'click', 'type', 'submit'],
  weights: {
    scroll: 30,   // users scroll a lot
    click: 20,    // clicking is common
    type: 10,     // typing is focused
    submit: 1,    // submit is rare
  },
})

// Bad: uniform distribution misses edge cases
export const generator = defineGenerator({
  actions: ['scroll', 'click', 'type', 'submit'],
  // No weights = uniform distribution
})
```

### State-Dependent Actions

Use `generate()` for context-aware action selection:

```typescript
export const generator = defineGenerator({
  actions: ['open', 'close', 'toggle', 'select'],

  generate(random, state) {
    // Can't close if nothing is open
    if (!state.isOpen) {
      return random.pick(['open', 'toggle'])
    }
    // Can't select if closed
    if (state.isOpen) {
      return random.pick(['close', 'toggle', 'select', 'select'])
    }
  },
})
```

### Action Sequences

Some bugs only appear with specific sequences:

```typescript
export const generator = defineGenerator({
  actions: ['a', 'b', 'c'],

  generate(random, state) {
    // 10% chance of triggering problematic sequence
    if (random.float() < 0.1) {
      return random.pick(['a', 'a', 'b']) // a→a→b sequence
    }
    return random.pick(this.actions)
  },
})
```

## Writing Effective Invariants

### Start Simple

Begin with obvious properties:

```typescript
export const invariants = defineInvariants({
  // Data exists
  hasData: (s) => s.items !== undefined,

  // Cursor in bounds
  cursorValid: (s) => s.cursor >= 0 && s.cursor < s.items.length,

  // No crashes (implicit, but good to be explicit)
  noException: () => true,
})
```

### Add Domain-Specific Rules

Then add business logic:

```typescript
export const invariants = defineInvariants({
  // Structural
  noDuplicateIds: (s) => new Set(s.items.map(i => i.id)).size === s.items.length,

  // Relational
  selectedExists: (s) => !s.selectedId || s.items.some(i => i.id === s.selectedId),

  // Business
  balanceNonNegative: (s) => s.balance >= 0,

  // UI
  visibleCursor: (s) => {
    const cursor = s.query('[data-cursor]')
    const viewport = s.query('[data-viewport]')
    if (!cursor || !viewport) return true
    return cursor.top >= viewport.top && cursor.bottom <= viewport.bottom
  },
})
```

### Informative Failures

Return strings for better error messages:

```typescript
export const invariants = defineInvariants({
  orderedTimestamps: (s) => {
    for (let i = 1; i < s.events.length; i++) {
      if (s.events[i].time < s.events[i-1].time) {
        return `Event ${i} (${s.events[i].time}) < Event ${i-1} (${s.events[i-1].time})`
      }
    }
    return true
  },
})
```

## Shrinking

When a failure is found, vitestx shrinks the action sequence to find the minimal reproduction.

### How Shrinking Works

1. **Binary search** on sequence length
2. **Remove individual actions** that don't affect failure
3. **Simplify action parameters** if applicable

```
Original: 47 actions → failure
Binary:   24 actions → pass
Binary:   36 actions → failure
Binary:   30 actions → failure
...
Minimal:  3 actions → failure

['j', 'j', 'h'] reproduces the bug
```

### Shrinking Strategies

vitestx uses multiple strategies:

- **Truncation**: Try shorter prefixes
- **Deletion**: Remove actions from middle
- **Simplification**: Replace complex actions with simpler ones

### Disabling Shrinking

For faster feedback during development:

```bash
FUZZ_SHRINK=false vitest fuzz
```

## Failure Reports

When fuzz testing finds a failure:

```
FAIL board.spec.ts > fuzz
  Invariant violated: cursorInBounds

  Seed: 12345
  Steps: 47 (shrunk from 156)
  Actions: j, j, k, Enter, j, ..., h

  State at failure:
    cursor: -1
    items: [{id: 1}, {id: 2}]

  Reproduce:
    FUZZ_SEED=12345 vitest fuzz board.spec.ts

  Minimal sequence:
    1. j     → cursor: 1
    2. j     → cursor: 2
    3. h     → cursor: -1  ✗
```

## CI Integration

### Deterministic Seeds

Use fixed seeds in CI for reproducibility:

```yaml
# .github/workflows/test.yml
- name: Fuzz tests
  run: vitest fuzz
  env:
    FUZZ_SEED: ${{ github.run_id }}  # or fixed value
    FUZZ_ITERATIONS: 500
```

### Seed Corpus

Maintain a corpus of interesting seeds:

```typescript
// fuzz.seeds.ts
export const KNOWN_SEEDS = [
  12345,  // Found cursor boundary bug
  67890,  # Found race condition
  11111,  // Edge case in sorting
]
```

```bash
for seed in $(cat fuzz.seeds.ts | grep -oE '[0-9]+'); do
  FUZZ_SEED=$seed vitest fuzz
done
```

## Advanced: Property-Based Testing

vitestx's fuzz mode is compatible with property-based testing patterns:

```typescript
import { fuzz } from 'vitestx'

fuzz('reverse is involutory', (random) => {
  const arr = random.array(random.int(0, 100), () => random.int())
  const reversed = arr.slice().reverse().reverse()
  expect(reversed).toEqual(arr)
})

fuzz('sort is idempotent', (random) => {
  const arr = random.array(random.int(0, 100), () => random.int())
  const sorted1 = arr.slice().sort()
  const sorted2 = sorted1.slice().sort()
  expect(sorted2).toEqual(sorted1)
})
```

## Comparison with fast-check

| Feature | vitestx fuzz | fast-check |
|---------|--------------|------------|
| Focus | UI/action sequences | Data generation |
| Shrinking | Action-sequence-aware | Value-aware |
| Integration | Vitest-native | Any test framework |
| Surface abstraction | Built-in | Manual |
| State machines | Via generator | Via commands API |

vitestx and fast-check are complementary. Use fast-check for data generation, vitestx for action sequences.
