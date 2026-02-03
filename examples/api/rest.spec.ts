/**
 * API REST Example
 *
 * Demonstrates vitestx surface for REST API testing.
 */

import { test, expect } from 'vitest'
import { defineSurface, defineGenerator, defineInvariants } from '../../src/index.js'

// Mock API state
interface ApiState {
  resources: Record<string, Record<string, unknown>>
  lastRequest: {
    method: string
    path: string
    body?: unknown
  } | null
  lastResponse: {
    status: number
    body: unknown
  } | null
}

interface ApiAction {
  type: 'get' | 'post' | 'put' | 'delete'
  path: string
  body?: unknown
}

function createApi(): ApiState {
  return {
    resources: {
      users: {
        '1': { id: '1', name: 'Alice', email: 'alice@example.com' },
        '2': { id: '2', name: 'Bob', email: 'bob@example.com' },
      },
      posts: {
        '1': { id: '1', title: 'Hello', authorId: '1' },
      },
    },
    lastRequest: null,
    lastResponse: null,
  }
}

// Mock REST handler
function handleRequest(state: ApiState, action: ApiAction): void {
  state.lastRequest = {
    method: action.type.toUpperCase(),
    path: action.path,
    body: action.body,
  }

  const [, resource, id] = action.path.split('/')

  if (!resource || !state.resources[resource]) {
    state.lastResponse = { status: 404, body: { error: 'Not found' } }
    return
  }

  const collection = state.resources[resource]

  switch (action.type) {
    case 'get':
      if (id) {
        const item = collection[id]
        if (item) {
          state.lastResponse = { status: 200, body: item }
        } else {
          state.lastResponse = { status: 404, body: { error: 'Not found' } }
        }
      } else {
        state.lastResponse = { status: 200, body: Object.values(collection) }
      }
      break

    case 'post':
      if (id) {
        state.lastResponse = { status: 400, body: { error: 'Cannot POST to specific ID' } }
      } else {
        const newId = String(Object.keys(collection).length + 1)
        const newItem = { ...action.body as object, id: newId }
        collection[newId] = newItem
        state.lastResponse = { status: 201, body: newItem }
      }
      break

    case 'put':
      if (!id) {
        state.lastResponse = { status: 400, body: { error: 'PUT requires ID' } }
      } else if (!collection[id]) {
        state.lastResponse = { status: 404, body: { error: 'Not found' } }
      } else {
        collection[id] = { ...action.body as object, id }
        state.lastResponse = { status: 200, body: collection[id] }
      }
      break

    case 'delete':
      if (!id) {
        state.lastResponse = { status: 400, body: { error: 'DELETE requires ID' } }
      } else if (!collection[id]) {
        state.lastResponse = { status: 404, body: { error: 'Not found' } }
      } else {
        delete collection[id]
        state.lastResponse = { status: 204, body: null }
      }
      break
  }
}

// --- vitestx exports ---

export const surface = defineSurface({
  create: () => createApi(),

  sendAction: (state, action: ApiAction) => {
    handleRequest(state, action)
  },

  getState: (state) => ({
    ...state,
    resources: JSON.parse(JSON.stringify(state.resources)),
  }),

  query: () => [],
})

export const actions: ApiAction[] = [
  { type: 'get', path: '/users' },
  { type: 'get', path: '/users/1' },
  { type: 'get', path: '/users/999' },
  { type: 'post', path: '/users', body: { name: 'Charlie', email: 'charlie@example.com' } },
  { type: 'put', path: '/users/1', body: { name: 'Alice Updated' } },
  { type: 'delete', path: '/users/1' },
  { type: 'get', path: '/posts' },
  { type: 'get', path: '/posts/1' },
  { type: 'delete', path: '/posts/1' },
]

export const invariants = defineInvariants<ApiState>({
  // Response status codes are valid HTTP status codes
  validStatusCode: (state) => {
    if (!state.lastResponse) return true
    const { status } = state.lastResponse
    if (status < 100 || status >= 600) {
      return `Invalid status code: ${status}`
    }
    return true
  },

  // 2xx responses should have body (except 204)
  successHasBody: (state) => {
    if (!state.lastResponse) return true
    const { status, body } = state.lastResponse
    if (status >= 200 && status < 300 && status !== 204 && body === undefined) {
      return `${status} response should have body`
    }
    return true
  },

  // All resources have IDs
  resourcesHaveIds: (state) => {
    for (const [name, collection] of Object.entries(state.resources)) {
      for (const [id, item] of Object.entries(collection)) {
        if ((item as { id?: string }).id !== id) {
          return `Resource ${name}/${id} has mismatched ID`
        }
      }
    }
    return true
  },

  // No duplicate IDs within a collection
  noDuplicateIds: (state) => {
    for (const [name, collection] of Object.entries(state.resources)) {
      const ids = Object.keys(collection)
      if (new Set(ids).size !== ids.length) {
        return `Duplicate IDs in ${name}`
      }
    }
    return true
  },
})

export const generator = defineGenerator({
  actions,
  maxSteps: 50,
  generate(random) {
    return random.pick(this.actions)
  },
})

export const description = `
A simple REST API with users and posts.

Endpoints:
- GET /users - list all users
- GET /users/:id - get user by ID
- POST /users - create user
- PUT /users/:id - update user
- DELETE /users/:id - delete user

Same for /posts

Status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 404 Not Found
`

// --- Hand-written tests ---

test('GET /users returns all users', () => {
  const api = surface.create()

  surface.sendAction(api, { type: 'get', path: '/users' })

  const state = surface.getState(api)
  expect(state.lastResponse?.status).toBe(200)
  expect(state.lastResponse?.body).toHaveLength(2)
})

test('GET /users/1 returns specific user', () => {
  const api = surface.create()

  surface.sendAction(api, { type: 'get', path: '/users/1' })

  const state = surface.getState(api)
  expect(state.lastResponse?.status).toBe(200)
  expect(state.lastResponse?.body).toMatchObject({ id: '1', name: 'Alice' })
})

test('GET /users/999 returns 404', () => {
  const api = surface.create()

  surface.sendAction(api, { type: 'get', path: '/users/999' })

  const state = surface.getState(api)
  expect(state.lastResponse?.status).toBe(404)
})

test('POST /users creates new user', () => {
  const api = surface.create()

  surface.sendAction(api, {
    type: 'post',
    path: '/users',
    body: { name: 'Charlie', email: 'charlie@example.com' },
  })

  const state = surface.getState(api)
  expect(state.lastResponse?.status).toBe(201)
  expect(state.lastResponse?.body).toMatchObject({ name: 'Charlie', id: '3' })
})

test('DELETE /users/1 removes user', () => {
  const api = surface.create()

  surface.sendAction(api, { type: 'delete', path: '/users/1' })

  let state = surface.getState(api)
  expect(state.lastResponse?.status).toBe(204)

  surface.sendAction(api, { type: 'get', path: '/users/1' })

  state = surface.getState(api)
  expect(state.lastResponse?.status).toBe(404)
})

test('DELETE then GET shows user gone', () => {
  const api = surface.create()

  // Verify user exists
  surface.sendAction(api, { type: 'get', path: '/users/1' })
  expect(surface.getState(api).lastResponse?.status).toBe(200)

  // Delete user
  surface.sendAction(api, { type: 'delete', path: '/users/1' })
  expect(surface.getState(api).lastResponse?.status).toBe(204)

  // Verify user gone
  surface.sendAction(api, { type: 'get', path: '/users/1' })
  expect(surface.getState(api).lastResponse?.status).toBe(404)
})
