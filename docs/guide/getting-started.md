# Getting Started

## Installation

```bash
bun add vitestx
```

vitestx has peer dependencies on `vitest` (required) and optionally `@silvery/term`, `react`, and `loggily` (for the Dotz reporter).

## Quick Examples

### Fuzz Testing

Write a test that generates random inputs and checks invariants:

```typescript
import { test, gen, take } from "vitestx"

test.fuzz("cursor stays in bounds", async () => {
  const handle = await setup()
  for await (const key of take(gen(["j", "k", "h", "l"]), 100)) {
    await handle.press(key)
    expect(getCursor()).toBeGreaterThanOrEqual(0)
  }
  // On failure: auto-shrinks to minimal repro, saves to __fuzz_cases__/
})
```

### Chaos Streams

Simulate unreliable delivery between async iterables:

```typescript
import { gen, take } from "vitestx"
import { drop, reorder } from "vitestx/chaos"

const events = gen(eventPicker)
const unreliable = reorder(drop(events, 0.2, rng), 5, rng)
for await (const event of take(unreliable, 200)) {
  await process(event)
}
```

### Dotz Reporter

Add the streaming dot reporter to your Vitest config:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    reporters: ["vitestx/dotz"],
  },
})
```

## Subpath Exports

```typescript
import { test, gen, take, createSeededRandom } from "vitestx" // Root: re-exports fuzz + utilities
import { test, gen, take } from "vitestx/fuzz" // Fuzz module directly
import { chaos, drop, reorder } from "vitestx/chaos" // Chaos stream transformers
import { vitestx } from "vitestx/plugin" // Vitest plugin
// Dotz reporter: use as --reporter=vitestx/dotz
```

## Reproducibility

```bash
# Run with a specific seed
FUZZ_SEED=12345 bun test

# Run multiple iterations with different seeds
FUZZ_REPEATS=1000 bun test

# Failures auto-save to __fuzz_cases__/ and replay on next run
bun test
```
