import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'examples/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
