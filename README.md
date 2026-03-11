# vimonkey

Fuzz testing and chaos streams for [Vitest](https://vitest.dev/).

## Fuzz Testing

Async generators with auto-shrinking, regression cases, and seeded RNG.

```typescript
import { test, gen, take } from "vimonkey"

test.fuzz("cursor stays in bounds", async () => {
  for await (const key of take(gen(["j", "k", "h", "l"]), 100)) {
    await handle.press(key)
    expect(getCursor()).toBeGreaterThanOrEqual(0)
  }
  // On failure: auto-shrinks to minimal repro, saves to __fuzz_cases__/
})
```

Generators support uniform arrays, weighted tuples, sync/async picker functions, and multi-value returns.

## Chaos Streams

Composable async iterable transformers that simulate unreliable delivery.

```typescript
import { chaos, drop, reorder } from "vimonkey/chaos"

const chaotic = chaos(
  source,
  [
    { type: "drop", params: { rate: 0.2 } },
    { type: "reorder", params: { windowSize: 5 } },
    { type: "duplicate", params: { rate: 0.1 } },
  ],
  rng,
)
```

Built-in transformers: `drop`, `reorder`, `duplicate`, `burst`, `initGap`, `delay`. Extend with custom registries.

## Install

```bash
npm install vimonkey
```

## Exports

```typescript
import { test, gen, take } from "vimonkey" // Fuzz testing
import { chaos, drop, reorder } from "vimonkey/chaos" // Chaos streams
import { viMonkeyPlugin } from "vimonkey/plugin" // Vitest plugin
```

## License

MIT
