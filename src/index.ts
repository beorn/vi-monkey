/**
 * vitestx - Vitest extension with fuzz and AI testing modes
 *
 * @example
 * ```typescript
 * import { defineSurface, defineGenerator, defineInvariants } from 'vitestx'
 *
 * export const surface = defineSurface({
 *   create: () => createInstance(),
 *   sendAction: (instance, action) => instance.dispatch(action),
 *   getState: (instance) => instance.getState(),
 *   query: (instance, selector) => instance.query(selector),
 * })
 *
 * export const actions = ['a', 'b', 'c']
 *
 * export const invariants = defineInvariants({
 *   valid: (state) => state.value >= 0,
 * })
 *
 * export const generator = defineGenerator({
 *   actions,
 *   weights: { a: 10, b: 5, c: 1 },
 *   maxSteps: 100,
 * })
 * ```
 */

// Core types
export type { Surface, SurfaceConfig } from './surfaces/types.js'
export type { Generator, GeneratorConfig } from './fuzz/generator.js'
export type { Invariant, Invariants, InvariantResult } from './invariants/dsl.js'

// DSL functions
export { defineSurface } from './surfaces/types.js'
export { defineGenerator } from './fuzz/generator.js'
export { defineInvariants } from './invariants/dsl.js'

// Environment
export { getTestSys, type TestSys } from './env.js'

// Fuzz testing
export { fuzz, type FuzzOptions, type Precondition } from './fuzz/index.js'
export type { FuzzRunResult } from './fuzz/runner.js'

// Action chooser (unified interface for fuzz/ai/replay)
export {
  createRandomChooser,
  createReplayChooser,
  createAiChooser,
  runWithChooser,
  type ActionChooser,
  type ChooserRunOptions,
  type ChooserRunResult,
  type AiChooserOptions,
} from './chooser/index.js'

// Model comparison
export {
  compareChoosers,
  measureDiscovery,
  type ChooserEvalResult,
  type ComparisonResult,
  type DiscoveryStats,
} from './compare/index.js'

// Random (for advanced use)
export { createSeededRandom, type SeededRandom } from './random.js'

// AI mode
export {
  runAiExploration,
  exploreWithFocus,
  defaultAiOptions,
  generateTestScenarios,
  buildSystemContext,
  formatContextForLLM,
  generateTestCode,
  saveGeneratedTest,
  type AiHarnessOptions,
  type AiStep,
  type ScenarioResult,
  type AiRunResult,
  type TestScenario,
  type BatchGenerationResult,
  type BatchGenerationOptions,
  type SystemContext,
  type ActionInfo,
  type InvariantInfo,
  type SaveOptions,
} from './ai/index.js'
