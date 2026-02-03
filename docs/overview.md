# vitestx: Unified Testing System

## Why This Exists

Testing is fragmented. You have:
- Unit tests (vitest, jest)
- Property-based tests (fast-check)
- Fuzz testing (separate tools)
- AI exploration (manual, ad-hoc)
- CLI tests (different framework)
- Benchmarks (yet another tool)

Each tool has its own DSL, its own way of defining what to test, its own output format. Switching between them is friction. Knowledge doesn't transfer.

**vitestx unifies everything under one abstraction: the Surface.**

## The Core Insight

All testing—unit, fuzz, AI, acceptance—does the same thing:

```
Create instance → Send actions → Check results
```

The only differences are:
1. **Who picks the actions**: human (unit), random (fuzz), or LLM (AI)
2. **What gets checked**: specific assertions (unit) or invariants (fuzz/AI)

By factoring out the "surface" (how to interact), we get:

```typescript
// Define once
export const surface = defineSurface({
  create: () => createBoard(),
  sendAction: (b, key) => b.press(key),
  getState: (b) => b.getState(),
})

// Use everywhere
test('manual', () => { ... })           // human picks actions
vitest fuzz                              // random picks actions
vitest ai                                // LLM picks actions
```

**One definition. Three testing modes. Zero duplication.**

## The Ergonomic Setup

### 1. Write Once, Test Many Ways

```typescript
// board.spec.ts - this one file enables ALL testing modes

export const surface = defineSurface({ ... })
export const actions = ['j', 'k', 'Enter', 'Escape']
export const invariants = defineInvariants({ ... })

// Hand-written tests (you write these)
test('cursor moves down', () => { ... })

// Fuzz tests (generated from surface + actions + invariants)
// AI tests (LLM explores using surface + actions + invariants)
```

### 2. Automatic Bug → Regression Test Pipeline

When fuzz or AI finds a bug:

```
1. Fuzz/AI finds failure
2. Shrinks to minimal sequence: ['j', 'j', 'h']
3. Logs seed for reproduction: FUZZ_SEED=12345
4. Optionally saves as regression test
```

The saved test looks like:

```typescript
// Generated: tests/regressions/cursor-boundary-12345.test.ts
test('cursor boundary (fuzz seed 12345)', () => {
  const instance = surface.create()
  surface.sendAction(instance, 'j')
  surface.sendAction(instance, 'j')
  surface.sendAction(instance, 'h')
  // Invariant 'cursorInBounds' failed here
  expect(surface.getState(instance).cursor).toBeGreaterThanOrEqual(0)
})
```

**Bugs automatically become regression tests. They never come back.**

### 3. Unified Command Interface

```bash
vitest              # hand-written tests
vitest fuzz         # random exploration
vitest ai           # LLM exploration
vitest bench        # benchmarks (standard vitest)
mdtest *.test.md    # CLI tests
```

All modes:
- Use the same surface definitions
- Report in consistent format
- Support the same env vars (FUZZ_SEED, TEST_SYS)
- Integrate with vitest's watch mode

## How Fuzz Mode Works

```
┌─────────────────────────────────────────────────────────────┐
│                    FUZZ TEST LOOP                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Create instance via surface.create()                    │
│                                                             │
│  2. Generate action from generator (seeded RNG)             │
│     └─ Respects weights: {j: 10, k: 10, Enter: 1}          │
│                                                             │
│  3. Execute via surface.sendAction(instance, action)        │
│                                                             │
│  4. Get state via surface.getState(instance)                │
│                                                             │
│  5. Check ALL invariants against state                      │
│     ├─ Pass → goto 2 (until maxSteps)                      │
│     └─ Fail → shrink and report                            │
│                                                             │
│  6. On failure:                                             │
│     a. Record seed + action sequence                        │
│     b. Shrink: binary search + deletion                     │
│     c. Report minimal reproduction                          │
│     d. Optionally save as regression test                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key properties:**
- Deterministic: same seed = same sequence
- Shrinking: 47 actions → 3 actions (minimal repro)
- Fast: 1000s of sequences per second with fakes

## How AI Mode Works

```
┌─────────────────────────────────────────────────────────────┐
│                     AI TEST LOOP                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Create instance via surface.create()                    │
│                                                             │
│  2. Send to LLM:                                            │
│     - Current state (JSON)                                  │
│     - Available actions                                     │
│     - Invariants (as descriptions)                          │
│     - History of previous actions + results                 │
│     - System description (if provided)                      │
│                                                             │
│  3. LLM reasons and picks action:                           │
│     "The cursor is at 0. Let me try 'k' to see if          │
│      it handles the top boundary correctly."                │
│                                                             │
│  4. Execute via surface.sendAction(instance, action)        │
│                                                             │
│  5. Check invariants                                        │
│     ├─ Pass → LLM reflects, goto 2                         │
│     └─ Fail → save finding                                 │
│                                                             │
│  6. LLM can also identify "interesting" states:             │
│     - Edge cases worth testing                              │
│     - Unexpected but valid behavior                         │
│     - Sequences that feel fragile                           │
│                                                             │
│  7. Save findings as:                                       │
│     - Regression tests (for failures)                       │
│     - Example tests (for interesting behavior)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key properties:**
- Semantic: LLM understands what actions mean
- Targeted: explores boundaries, edge cases intentionally
- Explainable: logs reasoning for each action
- Deterministic in CI: temperature=0

### Fuzz vs AI: Complementary

| Aspect | Fuzz | AI |
|--------|------|-----|
| Coverage | Broad, statistical | Targeted, semantic |
| Speed | 1000s/sec | 10s/sec |
| Finds | Random edge cases | Logical edge cases |
| Cost | Free | API costs |
| Best for | Regression, CI | Exploration, new features |

**Use both**: Fuzz for volume, AI for insight.

## The Alignment Principle

From km's principles.md:

> "Alignment makes code more readable AND more composable."

vitestx aligns:

**Names across layers:**
```typescript
// Surface methods match test helpers
surface.create()      // like render()
surface.sendAction()  // like press()
surface.getState()    // like getState()
surface.query()       // like query()
```

**Signatures across modes:**
```typescript
// Same invariants work for fuzz AND ai
export const invariants = defineInvariants({ ... })

// Same surface works for unit AND fuzz AND ai
export const surface = defineSurface({ ... })
```

**Commands across tools:**
```bash
vitest              # standard
vitest fuzz         # same pattern
vitest ai           # same pattern
vitest bench        # same pattern
```

## The TEST_SYS Convention

One env var controls infrastructure across ALL test modes:

```bash
TEST_SYS=fake vitest fuzz      # fuzz with fakes (fast)
TEST_SYS=real:mem vitest       # unit with real (integration)
TEST_SYS=real:disk vitest ai   # AI with disk (drift detection)
```

**Orthogonal concerns:**
- Test mode (unit/fuzz/ai) = who picks actions
- TEST_SYS (fake/real) = what infrastructure

Mix and match freely.

## Leveraging Bugs into Regression Tests

### Automatic (Fuzz/AI)

```bash
vitest fuzz --save          # save failures as tests
vitest ai --save            # save findings as tests
```

Generated tests go to `tests/regressions/` with:
- Original seed
- Minimal action sequence
- Invariant that failed
- Date found

### Manual (from CI failure)

```bash
# CI fails with seed
FUZZ_SEED=12345 vitest fuzz board.spec.ts  # reproduce locally

# Once fixed, the seed is in git history
# If regression occurs, same seed reproduces
```

### The Regression Guarantee

```typescript
// tests/regressions/cursor-boundary-12345.test.ts
// Found: 2024-01-15 via fuzz mode
// Bug: cursor could go negative at top boundary
// Fix: commit abc123

test('cursor boundary (seed 12345)', () => {
  const instance = surface.create()
  surface.sendAction(instance, 'j')
  surface.sendAction(instance, 'j')
  surface.sendAction(instance, 'h')
  expect(surface.getState(instance).cursor).toBeGreaterThanOrEqual(0)
})
```

**Rule: Never delete regression tests.** They document real bugs.

## What Makes This Ergonomic

1. **Single definition** - surface/actions/invariants defined once, used everywhere
2. **Automatic shrinking** - bugs reduced to minimal repro
3. **Seed-based reproduction** - any failure can be replayed
4. **Unified commands** - `vitest <mode>` for everything
5. **Convention over configuration** - works out of the box
6. **Orthogonal concerns** - mode vs infrastructure vs file type
7. **Incremental adoption** - add fuzz to existing tests by exporting invariants

## Quick Start → Full Power

**Day 1**: Write normal tests
```typescript
test('cursor moves', () => { ... })
```

**Day 2**: Extract surface
```typescript
export const surface = defineSurface({ ... })
test('cursor moves', () => {
  const b = surface.create()
  surface.sendAction(b, 'j')
  expect(surface.getState(b).cursor).toBe(1)
})
```

**Day 3**: Add invariants
```typescript
export const invariants = defineInvariants({
  cursorInBounds: (s) => s.cursor >= 0 && s.cursor < s.items.length,
})
```

**Day 4**: Fuzz it
```bash
vitest fuzz
```

**Day 5**: AI explores
```bash
vitest ai --save
```

**Day 6**: Bugs become regression tests automatically

**No rewrites. Incremental improvement. Everything aligns.**
