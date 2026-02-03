/**
 * AI mode exports
 */

// Harness
export {
  runAiExploration,
  exploreWithFocus,
  defaultAiOptions,
  type AiHarnessOptions,
  type AiStep,
  type ScenarioResult,
  type AiRunResult,
} from './harness.js'

// Batch generation
export {
  generateTestScenarios,
  type TestScenario,
  type BatchGenerationResult,
  type BatchGenerationOptions,
} from './batch.js'

// Introspection
export {
  buildSystemContext,
  formatContextForLLM,
  type SystemContext,
  type ActionInfo,
  type InvariantInfo,
} from './introspect.js'

// Save as regression test
export { generateTestCode, saveGeneratedTest, type SaveOptions } from './save.js'

// Mode options
export { type AiModeOptions, defaultAiOptions as aiModeDefaults } from './mode.js'
