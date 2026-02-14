# vitestx - Vitest Extension

Vitest extensions: fuzz testing (gen/take generators, test.fuzz() with auto-shrinking, chaos stream transformers) and dotz streaming reporter (inkx React terminal UI).

## Commands

bun test vendor/beorn-vitestx/ # run tests

## Architecture

src/
├── index.ts # Public API (re-exports fuzz)
├── plugin.ts # Vitest plugin
├── env.ts # TEST_SYS environment handling
├── random.ts # Seeded RNG (LCG algorithm)
├── fuzz/ # Fuzz testing API
│ ├── gen.ts # gen() and take() async generators
│ ├── test-fuzz.ts # test.fuzz() wrapper with tracking
│ ├── context.ts # FuzzContext for tracking state
│ ├── shrink.ts # Delta-debugging shrink
│ └── regression.ts # **fuzz_cases**/ save/load
├── chaos/ # Chaos stream transformers
│ └── index.ts # drop, reorder, duplicate, burst, initGap, delay + chaos()
└── dotz/ # Streaming dot reporter
├── index.tsx # DotzReporter class + React components
└── store.ts # TestStore (useSyncExternalStore)

## Subpath Exports

```typescript
import { test, gen, take } from "vitestx" // Root: re-exports fuzz + utilities
import { test, gen, take } from "vitestx/fuzz" // Fuzz: gen/take/test.fuzz/shrink/regression
import { chaos, drop, reorder } from "vitestx/chaos" // Chaos: stream transformers
import { vitestxPlugin } from "vitestx/plugin" // Vitest plugin
// Dotz reporter: use as --reporter=vitestx/dotz
```

## Key APIs

### gen/take (async generators)

gen(['j','k','h','l']) — uniform random from array
gen([[40,'j'],[40,'k'],[20,'Enter']]) — weighted random
gen((ctx) => ctx.random.pick([...])) — custom picker

take(generator, 100) — limit + auto-track for shrinking

### test.fuzz (vitest wrapper)

test.fuzz('name', async () => {
for await (const key of take(gen(['j','k']), 100)) {
await handle.press(key)
expect(...) // On failure: auto-shrink, save to **fuzz_cases**/
}
})

### Chaos stream transformers

Composable async iterable transformers: drop, reorder, duplicate, burst, initGap, delay.
Plus chaos() combinator with extensible ChaosRegistry<T>.

```typescript
import { chaos, drop, reorder, builtinChaosRegistry } from "vitestx/chaos"

const chaotic = chaos(
  source,
  [
    { type: "drop", params: { rate: 0.2 } },
    { type: "reorder", params: { windowSize: 5 } },
  ],
  rng,
)
```

## Future Improvements

All composable on the existing gen/take/test.fuzz primitives:

**Preconditioned generators** — filter actions based on current state:

```typescript
gen((ctx) => {
  const available = actions.filter((a) => preconditions[a]?.(getState()) ?? true)
  return ctx.random.pick(available)
})
```

**Automatic invariant checking** — check properties after every action:

```typescript
async function* withInvariants(source, check) {
  for await (const item of source) {
    yield item
    check()
  }
}
```

**AI-driven exploration** — LLM picks actions via custom picker:

```typescript
gen(async (ctx) => {
  const state = describeState(getState())
  return await askLLM(`Given state: ${state}, pick from: ${actions}`)
})
```

**Strategy comparison** — run same test with different generators:

```typescript
for (const strategy of [uniformGen, weightedGen, aiGen]) {
  test.fuzz(`invariants hold (${strategy.name})`, async () => {
    for await (const key of take(strategy, 100)) { ... }
  })
}
```

## Code Style

- Factory functions (`createX()` with options), not classes
- Explicit deps, no globals/singletons
- ESM imports only
- TypeScript strict mode
