/**
 * Luzia SDK factory.
 *
 * In remote mode each user presents their own API key, so we cache one SDK
 * client per key rather than sharing a single singleton. The cache is bounded
 * to avoid leaking clients for one-off keys.
 */

import { Luzia } from '@luziadev/sdk'
import { env } from './config.js'
import { createLogger } from './logging.js'

const log = createLogger({ module: 'sdk' })

const MAX_CLIENTS = 500
const clients = new Map<string, Luzia>()

export function getLuziaClientForKey(apiKey: string): Luzia {
  const existing = clients.get(apiKey)
  if (existing) {
    // refresh LRU order
    clients.delete(apiKey)
    clients.set(apiKey, existing)
    return existing
  }

  const client = new Luzia({
    apiKey,
    baseUrl: env.api.url,
  })
  clients.set(apiKey, client)

  if (clients.size > MAX_CLIENTS) {
    const oldest = clients.keys().next().value
    if (oldest !== undefined) clients.delete(oldest)
  }

  log.debug({ baseUrl: env.api.url, cached: clients.size }, 'Luzia SDK client created')
  return client
}
