/**
 * AI mode for vitest
 *
 * Implements `vitest ai` command for LLM-driven exploration.
 */

// TODO: Implement AI mode integration with vitest CLI
// This will intercept `vitest ai` and run AI-driven tests

export interface AiModeOptions {
  model: string
  temperature: number
  maxSteps: number
  maxTokens: number
  saveDir?: string
  provider: 'openai' | 'anthropic' | 'claude-code'
}

export const defaultAiOptions: AiModeOptions = {
  model: 'claude-sonnet',
  temperature: 0,
  maxSteps: 50,
  maxTokens: 10000,
  provider: 'anthropic',
}
