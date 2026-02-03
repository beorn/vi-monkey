# vitestx

**One surface. Every testing mode.**

Testing is fragmented: unit tests, property tests, fuzz tests, AI exploration, CLI tests—each with its own DSL, its own mental model, its own friction. vitestx unifies them under one abstraction.

```typescript
// Define once
export const surface = defineSurface({
  create: () => createBoard(),
  sendAction: (b, key) => b.press(key),
  getState: (b) => b.getState(),
})

export const actions = ['j', 'k', 'Enter', 'Escape']

export const invariants = defineInvariants({
  cursorInBounds: (s) => s.cursor >= 0 && s.cursor < s.items.length,
})

// Use everywhere
test('cursor moves', () => { ... })  // you pick actions
vitest fuzz                           // random picks actions
vitest ai                             // LLM picks actions
```

**Zero duplication. Three testing modes. Bugs become regression tests automatically.**

## How It Works

All testing does the same thing: create instance → send actions → check results.

The only difference is *who picks the actions*:
- **Unit tests**: You write them
- **Fuzz tests**: Seeded RNG generates them (shrinks failures to minimal repro)
- **AI tests**: LLM reasons about state and picks them (finds semantic edge cases)

The surface abstraction makes this explicit. Define it once, get all three modes.

## Quick Start

```bash
bun add vitestx
```

```typescript
// counter.spec.ts
import { defineSurface, defineInvariants } from 'vitestx'

export const surface = defineSurface({
  create: () => ({ value: 0 }),
  sendAction: (s, a) => { if (a === 'inc') s.value++ },
  getState: (s) => ({ value: s.value }),
})

export const actions = ['inc', 'dec', 'reset']

export const invariants = defineInvariants({
  finite: (s) => Number.isFinite(s.value),
})
```

```bash
vitest              # your tests
vitest fuzz         # random exploration
vitest ai           # LLM exploration
```

## The Ergonomic Setup

1. **Single definition** - surface/actions/invariants used by all modes
2. **Automatic shrinking** - 47 actions → 3 action minimal repro
3. **Seed reproduction** - `FUZZ_SEED=12345 vitest fuzz` replays exactly
4. **Bug → regression** - `vitest fuzz --save` captures failures as tests
5. **Orthogonal concerns** - test mode × infrastructure (TEST_SYS) × file type

## CLI Tests (mdtest)

For command-line testing, markdown files:

````markdown
```console
$ echo "hello"
hello
```
````

```bash
mdtest cli.test.md
```

See [mdtest docs](../beorn-mdtest/README.md) for patterns and features.

## Documentation

- **[Overview](./docs/overview.md)** - Why this exists, how it all fits together
- [Getting Started](./docs/getting-started.md) - Quick start guide
- [Core Concepts](./docs/concepts.md) - Surface, Generator, Invariant
- [Conventions](./docs/conventions.md) - TEST_SYS, file naming, patterns
- [Fuzz Mode](./docs/fuzz-mode.md) - Random exploration details
- [AI Mode](./docs/ai-mode.md) - LLM exploration details

## License

MIT
