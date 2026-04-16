/**
 * MCP Server Configuration
 *
 * Environment-based configuration for the MCP server.
 * This server acts as a thin proxy to the Luzia API.
 *
 * In HTTP (remote) mode each user presents their own API key via the
 * Authorization header, so LUZIA_API_KEY is optional at startup. In stdio
 * (local) mode the API key must come from the environment because stdio has
 * no request headers — assertStdioConfig() enforces that at launch time.
 */

import { z } from 'zod'

const DEFAULT_ALLOWED_ORIGINS = [
  'https://claude.ai',
  'https://console.anthropic.com',
  'https://luzia.dev',
]

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  MCP_PORT: z.coerce.number().default(50080),
  ALLOWED_ORIGINS: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Luzia API
  LUZIA_API_URL: z.string().url().default('http://localhost:3000'),
  LUZIA_API_KEY: z.string().min(1).optional(),
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

function parseAllowedOrigins(raw: string | undefined, nodeEnv: EnvSchema['NODE_ENV']): string[] {
  const explicit = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...DEFAULT_ALLOWED_ORIGINS]

  // In non-prod, always allow localhost for developer convenience.
  if (nodeEnv !== 'production') {
    for (const origin of [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ]) {
      if (!explicit.includes(origin)) explicit.push(origin)
    }
  }

  return explicit
}

export const env = {
  server: {
    nodeEnv: parsedEnv.NODE_ENV,
    port: parsedEnv.MCP_PORT,
    allowedOrigins: parseAllowedOrigins(parsedEnv.ALLOWED_ORIGINS, parsedEnv.NODE_ENV),
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

/**
 * Stdio mode can't read headers, so LUZIA_API_KEY must be set in env.
 * Call this from startStdioServer() to fail fast with a clear message.
 */
export function assertStdioConfig(): void {
  if (!env.api.key) {
    // biome-ignore lint/suspicious/noConsole: runs before logger is fully wired
    console.error(
      'LUZIA_API_KEY is required in stdio mode. Set it in your MCP client config or environment.'
    )
    process.exit(1)
  }
}
