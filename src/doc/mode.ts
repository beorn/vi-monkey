/**
 * Doc mode for vitest
 *
 * Implements `vitest doc` command for mdtest (Cram-style) integration.
 */

// TODO: Integrate with @beorn/mdtest vitest plugin
// This will re-export mdtest's vitest integration

export interface DocModeOptions {
  pattern: string
}

export const defaultDocOptions: DocModeOptions = {
  pattern: '**/*.test.md',
}
