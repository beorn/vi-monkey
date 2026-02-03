import { describe, test, expect } from 'vitest'
import { parseArgs } from '../src/cli/index.js'

describe('parseArgs', () => {
  test('defaults to test mode', () => {
    const result = parseArgs([])
    expect(result.mode).toBe('test')
  })

  test('parses fuzz mode', () => {
    const result = parseArgs(['fuzz'])
    expect(result.mode).toBe('fuzz')
  })

  test('parses ai mode', () => {
    const result = parseArgs(['ai'])
    expect(result.mode).toBe('ai')
  })

  test('parses doc mode', () => {
    const result = parseArgs(['doc'])
    expect(result.mode).toBe('doc')
  })

  test('extracts file arguments', () => {
    const result = parseArgs(['fuzz', 'board.spec.ts', 'counter.spec.ts'])
    expect(result.options.files).toEqual(['board.spec.ts', 'counter.spec.ts'])
  })

  test('parses --seed option', () => {
    const result = parseArgs(['fuzz', '--seed', '12345'])
    expect(result.options.fuzz?.seed).toBe(12345)
  })

  test('parses --iterations option', () => {
    const result = parseArgs(['fuzz', '--iterations', '500'])
    expect(result.options.fuzz?.iterations).toBe(500)
  })

  test('parses --model option', () => {
    const result = parseArgs(['ai', '--model', 'gpt-4'])
    expect(result.options.ai?.model).toBe('gpt-4')
  })

  test('parses multiple --focus options', () => {
    const result = parseArgs(['ai', '--focus', 'boundaries', '--focus', 'rapid actions'])
    expect(result.options.ai?.focus).toEqual(['boundaries', 'rapid actions'])
  })

  test('parses --scenario-count option', () => {
    const result = parseArgs(['ai', '--scenario-count', '20'])
    expect(result.options.ai?.scenarioCount).toBe(20)
  })

  test('parses --pattern option', () => {
    const result = parseArgs(['doc', '--pattern', 'docs/*.test.md'])
    expect(result.options.doc?.pattern).toBe('docs/*.test.md')
  })

  test('mixed files and options', () => {
    const result = parseArgs(['fuzz', 'board.spec.ts', '--seed', '999', '--iterations', '50'])
    expect(result.mode).toBe('fuzz')
    expect(result.options.files).toEqual(['board.spec.ts'])
    expect(result.options.fuzz?.seed).toBe(999)
    expect(result.options.fuzz?.iterations).toBe(50)
  })

  test('unknown mode defaults to test', () => {
    const result = parseArgs(['unknown'])
    expect(result.mode).toBe('test')
  })
})
