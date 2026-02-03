/**
 * System introspection for AI mode
 *
 * Extracts context from spec files to provide LLM with full system understanding.
 * This allows generating complete test sequences with fewer API calls.
 */

import type { Surface } from '../surfaces/types.js'
import type { Generator } from '../fuzz/generator.js'
import type { Invariants } from '../invariants/dsl.js'

/**
 * Introspected system context for LLM
 */
export interface SystemContext {
  /** Human-readable description of the system */
  description: string
  /** Available actions with descriptions */
  actions: ActionInfo[]
  /** Invariants that must hold */
  invariants: InvariantInfo[]
  /** Example state shape (JSON schema-like) */
  stateShape: Record<string, unknown>
  /** Initial state example */
  initialState: unknown
  /** User-provided exploration hints */
  focus?: string[]
}

export interface ActionInfo {
  name: string
  description?: string
  /** Estimated frequency (from generator weights) */
  weight?: number
}

export interface InvariantInfo {
  name: string
  /** Extracted from function body or provided */
  description?: string
}

/**
 * Build system context from spec exports
 */
export function buildSystemContext<State, Action extends string, Instance>(
  surface: Surface<State, Action, Instance>,
  actions: readonly Action[],
  invariants: Invariants<State>,
  options: {
    description?: string
    generator?: Generator<Action>
    focus?: string[]
  } = {}
): SystemContext {
  // Create instance to get initial state shape
  const instance = surface.create()
  const initialState = surface.getState(instance)
  surface.dispose?.(instance)

  // Extract action info
  const actionInfos: ActionInfo[] = actions.map((action) => ({
    name: action,
    weight: options.generator?.weights?.[action],
  }))

  // Extract invariant info
  const invariantInfos: InvariantInfo[] = Object.entries(invariants).map(
    ([name, fn]) => ({
      name,
      description: extractInvariantDescription(fn),
    })
  )

  // Infer state shape from initial state
  const stateShape = inferStateShape(initialState)

  return {
    description: options.description || 'System under test',
    actions: actionInfos,
    invariants: invariantInfos,
    stateShape,
    initialState,
    focus: options.focus,
  }
}

/**
 * Try to extract a description from invariant function
 * (looks for return strings which are error messages)
 */
function extractInvariantDescription(fn: Function): string | undefined {
  const source = fn.toString()
  // Look for return string patterns like: return `Value ${x} is negative`
  const match = source.match(/return\s+[`'"](.*?)[`'"]/)
  if (match) {
    // Clean up template literal placeholders
    return match[1].replace(/\$\{[^}]+\}/g, '<value>')
  }
  return undefined
}

/**
 * Infer a JSON-schema-like shape from a value
 */
function inferStateShape(value: unknown): Record<string, unknown> {
  if (value === null) return { type: 'null' }
  if (value === undefined) return { type: 'undefined' }

  const type = typeof value
  if (type === 'string') return { type: 'string' }
  if (type === 'number') return { type: 'number' }
  if (type === 'boolean') return { type: 'boolean' }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferStateShape(value[0]) : { type: 'unknown' },
    }
  }

  if (type === 'object') {
    const shape: Record<string, unknown> = { type: 'object', properties: {} }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      ;(shape.properties as Record<string, unknown>)[key] = inferStateShape(val)
    }
    return shape
  }

  return { type }
}

/**
 * Format system context as LLM prompt
 */
export function formatContextForLLM(context: SystemContext): string {
  const lines: string[] = []

  lines.push('# System Under Test')
  lines.push('')
  lines.push(context.description)
  lines.push('')

  lines.push('## Available Actions')
  lines.push('')
  for (const action of context.actions) {
    const weight = action.weight ? ` (weight: ${action.weight})` : ''
    lines.push(`- \`${action.name}\`${weight}`)
  }
  lines.push('')

  lines.push('## Invariants (must always hold)')
  lines.push('')
  for (const inv of context.invariants) {
    const desc = inv.description ? `: ${inv.description}` : ''
    lines.push(`- **${inv.name}**${desc}`)
  }
  lines.push('')

  lines.push('## State Shape')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(context.stateShape, null, 2))
  lines.push('```')
  lines.push('')

  lines.push('## Initial State')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(context.initialState, null, 2))
  lines.push('```')

  if (context.focus && context.focus.length > 0) {
    lines.push('')
    lines.push('## Exploration Focus')
    lines.push('')
    lines.push('Pay special attention to:')
    for (const hint of context.focus) {
      lines.push(`- ${hint}`)
    }
  }

  return lines.join('\n')
}
