/**
 * MCP Server Configuration
 *
 * Environment-based configuration for the MCP server.
 * This server acts as a thin proxy to the Luzia API.
 */

import { z } from 'zod'

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  MCP_PORT: z.coerce.number().default(50060),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Luzia API
  LUZIA_API_URL: z.string().url().default('http://localhost:3000'),
  LUZIA_API_KEY: z.string().min(1),
})

type EnvSchema = z.infer<typeof envSchema>

function loadEnv(): EnvSchema {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    // biome-ignore lint/suspicious/noConsole: Required for startup validation errors before logger is available
    console.error('Invalid environment variables:', result.error.format())
    process.exit(1)
  }

  return result.data
}

const parsedEnv = loadEnv()

export const env = {
  server: {
    nodeEnv: parsedEnv.NODE_ENV,
    port: parsedEnv.MCP_PORT,
  },
  logging: {
    level: parsedEnv.LOG_LEVEL,
  },
  api: {
    url: parsedEnv.LUZIA_API_URL,
    key: parsedEnv.LUZIA_API_KEY,
  },
} as const

export type Env = typeof env
