/**
 * API surface adapter
 *
 * Provides surface for REST/HTTP API testing.
 */

import type { Surface } from './types.js'

/**
 * HTTP request action
 */
export interface HttpAction {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  headers?: Record<string, string>
  body?: unknown
}

/**
 * HTTP response
 */
export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

/**
 * API state
 */
export interface ApiState<T = Record<string, unknown>> {
  baseUrl: string
  defaultHeaders: Record<string, string>
  lastRequest: HttpAction | null
  lastResponse: HttpResponse | null
  data: T
}

/**
 * Create an API surface
 *
 * @example
 * ```typescript
 * import { createApiSurface } from 'vitestx'
 *
 * export const surface = createApiSurface({
 *   baseUrl: 'http://localhost:3000',
 *   handler: async (state, request) => {
 *     // Handle request and return response
 *     return { status: 200, headers: {}, body: { ok: true } }
 *   },
 * })
 * ```
 */
export function createApiSurface<T = Record<string, unknown>>(config: {
  baseUrl: string
  defaultHeaders?: Record<string, string>
  initialData?: T
  handler: (state: ApiState<T>, request: HttpAction) => HttpResponse | Promise<HttpResponse>
}): Surface<ApiState<T>, HttpAction, ApiState<T>> {
  return {
    create: () => ({
      baseUrl: config.baseUrl,
      defaultHeaders: { ...config.defaultHeaders },
      lastRequest: null,
      lastResponse: null,
      data: (config.initialData ?? {}) as T,
    }),

    sendAction: async (state, action) => {
      state.lastRequest = action
      state.lastResponse = await config.handler(state, action)
    },

    getState: (state) => ({
      ...state,
      data: JSON.parse(JSON.stringify(state.data)),
    }),

    query: () => [],
  }
}

/**
 * Helper to create standard REST actions
 */
export function restAction(
  method: HttpAction['method'],
  path: string,
  body?: unknown
): HttpAction {
  return { method, path, body }
}

export const get = (path: string) => restAction('GET', path)
export const post = (path: string, body?: unknown) => restAction('POST', path, body)
export const put = (path: string, body?: unknown) => restAction('PUT', path, body)
export const patch = (path: string, body?: unknown) => restAction('PATCH', path, body)
export const del = (path: string) => restAction('DELETE', path)
