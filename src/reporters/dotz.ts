/**
 * Dotz reporter
 *
 * Minimal dot-based progress reporter inspired by inkx.
 * Shows . for pass, F for fail, compact output for CI.
 */

export interface DotzReporterOptions {
  /** Characters per line before wrapping */
  lineWidth?: number
  /** Show summary at end */
  showSummary?: boolean
}

export interface DotzState {
  passed: number
  failed: number
  total: number
  line: string
  lines: string[]
}

/**
 * Create a dotz reporter
 */
export function createDotzReporter(options: DotzReporterOptions = {}): {
  state: DotzState
  onPass(): void
  onFail(): void
  getOutput(): string
} {
  const { lineWidth = 50, showSummary = true } = options

  const state: DotzState = {
    passed: 0,
    failed: 0,
    total: 0,
    line: '',
    lines: [],
  }

  function addChar(char: string) {
    state.line += char
    state.total++

    if (state.line.length >= lineWidth) {
      state.lines.push(state.line)
      state.line = ''
    }
  }

  return {
    state,

    onPass() {
      state.passed++
      addChar('.')
    },

    onFail() {
      state.failed++
      addChar('F')
    },

    getOutput() {
      const lines = [...state.lines]
      if (state.line) {
        lines.push(state.line)
      }

      let output = lines.join('\n')

      if (showSummary) {
        output += '\n\n'
        if (state.failed === 0) {
          output += `✓ ${state.passed} passed`
        } else {
          output += `✗ ${state.failed} failed, ${state.passed} passed`
        }
        output += ` (${state.total} total)`
      }

      return output
    },
  }
}
