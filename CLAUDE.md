# vitestx - Vitest Extension

Vitest plugin adding fuzz and AI testing modes with unified surface abstractions.

## Commands

```bash
# From monorepo root or package directory
bun test vendor/beorn-vitestx/   # run tests
cd vendor/beorn-vitestx && bun run build   # compile TypeScript
```

## Architecture

```
src/
├── index.ts           # Main exports (defineSurface, defineGenerator, etc.)
├── plugin.ts          # Unified vitest plugin
├── env.ts             # TEST_SYS environment handling
├── random.ts          # Seeded RNG (LCG algorithm)
│
├── fuzz/              # Fuzz testing mode
│   ├── mode.ts        # vitest fuzz integration
│   ├── generator.ts   # defineGenerator DSL
│   ├── runner.ts      # Fuzz execution loop
│   └── shrink.ts      # Minimal failing case finder
│
├── ai/                # AI testing mode
│   ├── mode.ts        # vitest ai integration
│   ├── harness.ts     # LLM integration
│   └── save.ts        # Save as regression test
│
├── doc/               # mdtest integration
│   └── mode.ts        # vitest doc mode
│
├── surfaces/          # Surface adapters
│   ├── types.ts       # Surface<State, Action> interface
│   ├── tui.ts         # TUI adapter (inkx-compatible)
│   ├── cli.ts         # CLI adapter
│   └── api.ts         # API adapter
│
├── invariants/        # Invariant checking
│   ├── dsl.ts         # defineInvariants
│   └── checker.ts     # Runtime checking
│
└── reporters/         # Output formatting
    ├── dotz.ts        # Dotz reporter (from inkx)
    └── fuzz.ts        # Fuzz-specific reporting
```

## Key Concepts

### Surface
Unified interface for the thing under test (TUI, CLI, API):
```typescript
interface Surface<State, Action> {
  create(): SurfaceInstance
  sendAction(instance, action): void
  getState(instance): State
  query(instance, selector): Element[]
  dispose(instance): void
}
```

### Generator
Weighted random action selection for fuzz mode:
```typescript
const generator = defineGenerator({
  actions: ['j', 'k', 'Enter'],
  weights: { j: 10, k: 10, Enter: 5 },
  maxSteps: 100,
})
```

### Invariant
Properties that must always hold:
```typescript
const invariants = defineInvariants({
  singleCursor: (s) => s.queryAll("[data-cursor]").length === 1,
})
```

## Code from km

Reuses patterns from:
- `packages/km-storage/src/testing/chaos-*.ts` - seeded random, event hooks
- `vendor/beorn-inkx/src/testing/dotz-reporter.ts` - test output formatting
- `apps/km-tui/tests/helpers/board-test.ts` - TUI surface patterns

## Code Style

- Factory functions (`defineX()` with options), not classes
- Explicit deps, no globals/singletons
- ESM imports only
- TypeScript strict mode
