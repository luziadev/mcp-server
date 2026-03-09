/**
 * Luzia SDK Singleton
 *
 * Provides a shared Luzia SDK client instance for all MCP tools and prompts.
 */

import { Luzia } from '@luziadev/sdk'
import { env } from './config.js'
import { createLogger } from './logging.js'

const log = createLogger({ module: 'sdk' })

let instance: Luzia | null = null

/**
 * Get the shared Luzia SDK client instance
 */
export function getLuziaClient(): Luzia {
  if (!instance) {
    instance = new Luzia({
      apiKey: env.api.key,
      baseUrl: env.api.url,
    })
    log.info({ baseUrl: env.api.url }, 'Luzia SDK client initialized')
  }
  return instance
}
