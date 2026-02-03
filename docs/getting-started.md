# Getting Started

vitestx extends Vitest with fuzz and AI testing modes.

## Installation

```bash
bun add vitestx
```

## Configuration

No configuration needed for basic usage. The plugin auto-detects spec files.

For customization, add to `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import { vitestx } from 'vitestx/plugin'

export default defineConfig({
  plugins: [vitestx()]  // defaults work for most cases
})
```

## Spec File Structure

A spec file exports a **surface** (required) and **invariants** (required for fuzz mode).

| Export | Required | Purpose |
|--------|----------|---------|
| `surface` | Yes | How to interact with the thing under test |
| `invariants` | For fuzz/ai | Properties that must always hold |
| `actions` | For fuzz/ai | Available actions (strings or objects) |
| `generator` | No | Weights/limits for fuzz mode |
| `description` | No | Context for AI mode |

## Minimal Example

```typescript
// counter.spec.ts
import { test, expect } from 'vitest'
import { defineSurface, defineInvariants } from 'vitestx'
import { createCounter } from './counter'

// Required: define the surface
export const surface = defineSurface({
  create: () => createCounter(),
  sendAction: (c, action) => c[action](),
  getState: (c) => ({ value: c.value }),
})

// Required for fuzz: available actions
export const actions = ['increment', 'decrement', 'reset']

// Required for fuzz: invariants to check
export const invariants = defineInvariants({
  finite: (s) => Number.isFinite(s.value),
})

// Hand-written tests work alongside
test('increment increases value', () => {
  const c = surface.create()
  surface.sendAction(c, 'increment')
  expect(surface.getState(c).value).toBe(1)
})
```

## Running Tests

```bash
vitest              # hand-written tests
vitest fuzz         # random action sequences
vitest ai           # LLM-driven exploration
```

## CLI Tests with mdtest

For CLI/command-line testing, use mdtest (Cram-style tests in markdown).

Create `cli.test.md`:

````markdown
# CLI Tests

Test your command output:

```console
$ echo "hello"
hello
```

Pattern matching with wildcards:

```console
$ date +"%Y-%m-%d"
*-*-*
```

Regex patterns:

```console
$ ls *.ts
/.*\.ts/
```
````

Run with:

```bash
mdtest cli.test.md              # standalone
mdtest --update cli.test.md     # update snapshots
```

See [mdtest documentation](../vendor/beorn-mdtest/README.md) for:
- Temp directories per test
- Helper files with `file=` syntax
- Exit codes and stderr testing
- Named captures `{{name:*}}`

## Reproducibility

Fuzz failures include the seed:

```
FAIL counter.spec.ts
  Invariant violated: finite
  Seed: 12345
  Reproduce: FUZZ_SEED=12345 vitest fuzz counter.spec.ts
```

## Optional: Generator

Add weights or limits:

```typescript
import { defineGenerator } from 'vitestx'

export const generator = defineGenerator({
  actions,
  weights: { increment: 10, decrement: 10, reset: 1 },
  maxSteps: 50,
})
```

## Next Steps

- [Core Concepts](./concepts.md) - Surface, Generator, Invariant
- [Conventions](./conventions.md) - Testing patterns (TEST_SYS, file naming)
- [Fuzz Mode](./fuzz-mode.md) - Fuzz testing details
- [AI Mode](./ai-mode.md) - LLM exploration
