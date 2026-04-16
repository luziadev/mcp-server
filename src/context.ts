/**
 * Request-scoped context for the MCP server.
 *
 * Carries the authenticated user's Luzia API key from the transport layer
 * (HTTP handler or stdio bootstrap) down to tool/resource handlers without
 * threading it through every function signature.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export type RequestContext = {
  apiKey: string
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

/**
 * Read the API key bound to the current request. Throws if no context is
 * active — this indicates a bug (a handler ran outside of requestContext.run).
 */
export function getCurrentApiKey(): string {
  const ctx = requestContext.getStore()
  if (!ctx?.apiKey) {
    throw new Error('No API key in request context')
  }
  return ctx.apiKey
}
