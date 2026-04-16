#!/usr/bin/env node
/**
 * Luzia MCP Server
 *
 * Model Context Protocol server for cryptocurrency pricing data. This server
 * is a thin proxy that forwards tool calls to the Luzia API.
 *
 * Transports:
 * - HTTP (Streamable HTTP) — remote mode. Each user presents their own
 *   Luzia API key via `Authorization: Bearer lz_...` on session init; the
 *   key is bound to the MCP session and reused for subsequent calls.
 * - stdio — local mode for Claude Desktop. API key comes from
 *   `LUZIA_API_KEY` env.
 */

import { serve } from '@hono/node-server'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { assertStdioConfig, env } from './config.js'
import { requestContext } from './context.js'
import { createLogger, logger } from './logging.js'
import { checkAbuse, recordAuthFailure, resetAbuse } from './middleware/abuse-guard.js'
import { createMCPServer } from './server.js'

const log = createLogger({ module: 'main' })

const SESSION_IDLE_MS = 30 * 60_000
const SESSION_SWEEP_INTERVAL_MS = 5 * 60_000
const MAX_CONCURRENT_SESSIONS = 10_000

type SessionRecord = {
  transport: WebStandardStreamableHTTPServerTransport
  apiKey: string
  createdAt: number
  lastSeenAt: number
}

const banner = `
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │   ██╗     ██╗   ██╗███████╗██╗ █████╗     ███╗   ███╗ ██████╗██████╗  │
  │   ██║     ██║   ██║╚══███╔╝██║██╔══██╗    ████╗ ████║██╔════╝██╔══██╗ │
  │   ██║     ██║   ██║  ███╔╝ ██║███████║    ██╔████╔██║██║     ██████╔╝ │
  │   ██║     ██║   ██║ ███╔╝  ██║██╔══██║    ██║╚██╔╝██║██║     ██╔═══╝  │
  │   ███████╗╚██████╔╝███████╗██║██║  ██║    ██║ ╚═╝ ██║╚██████╗██║      │
  │   ╚══════╝ ╚═════╝ ╚══════╝╚═╝╚═╝  ╚═╝    ╚═╝     ╚═╝ ╚═════╝╚═╝      │
  │                                                          │
  │   MCP Server for Cryptocurrency Pricing                  │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
`

function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(\S+)$/i)
  if (!match) return null
  const token = match[1]
  if (!token.startsWith('lz_')) return null
  return token
}

function extractClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}

function corsOriginCheck(origin: string | undefined): string | null {
  if (!origin) return null
  if (env.server.allowedOrigins.includes(origin)) return origin
  if (env.server.nodeEnv !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return origin
  }
  return null
}

async function startHTTPServer(): Promise<void> {
  const app = new Hono()

  const sessions = new Map<string, SessionRecord>()

  app.use(
    '/mcp',
    cors({
      origin: (origin) => corsOriginCheck(origin) ?? '',
      allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id', 'mcp-protocol-version'],
      exposeHeaders: ['mcp-session-id'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      credentials: false,
      maxAge: 600,
    })
  )

  app.all('/mcp', async (c) => {
    const ip = extractClientIp(c.req.raw.headers)
    const abuse = checkAbuse(ip)
    if (abuse.blocked) {
      return c.json(
        { error: 'too_many_requests', message: 'Too many auth failures. Try again later.' },
        429,
        { 'Retry-After': String(abuse.retryAfterSeconds) }
      )
    }

    const sessionId = c.req.header('mcp-session-id')
    const now = Date.now()

    let record = sessionId ? sessions.get(sessionId) : undefined

    if (!record && sessionId) {
      // Client sent an id we don't know — session was evicted or server restarted.
      return c.json(
        { error: 'session_not_found', message: 'Unknown session id. Please re-initialize.' },
        404
      )
    }

    if (!record) {
      // Session init. Require Bearer.
      const apiKey = extractBearer(c.req.header('authorization'))
      if (!apiKey) {
        recordAuthFailure(ip)
        return c.json(
          {
            error: 'unauthorized',
            message:
              'Missing or invalid Authorization header. Provide `Authorization: Bearer lz_<your_luzia_api_key>`.',
          },
          401,
          { 'WWW-Authenticate': 'Bearer realm="luzia-mcp"' }
        )
      }

      if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
        return c.json(
          { error: 'service_unavailable', message: 'Server at capacity. Try again later.' },
          503
        )
      }

      resetAbuse(ip)

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          log.info({ sessionId: newSessionId }, 'MCP session initialized')
          sessions.set(newSessionId, {
            transport,
            apiKey,
            createdAt: now,
            lastSeenAt: now,
          })
        },
        onsessionclosed: (closedSessionId) => {
          log.info({ sessionId: closedSessionId }, 'MCP session closed')
          sessions.delete(closedSessionId)
        },
      })

      const mcpServer = createMCPServer()
      await mcpServer.connect(transport)

      record = { transport, apiKey, createdAt: now, lastSeenAt: now }
    } else {
      record.lastSeenAt = now
    }

    return requestContext.run({ apiKey: record.apiKey }, () =>
      record.transport.handleRequest(c.req.raw)
    )
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      server: 'luzia-mcp',
      version: '1.3.0',
      activeSessions: sessions.size,
      apiUrl: env.api.url,
    })
  })

  app.get('/', (c) => {
    return c.json({
      name: 'Luzia MCP Server',
      version: '1.3.0',
      description: 'Model Context Protocol server for cryptocurrency pricing data',
      transport: 'Streamable HTTP with Bearer auth',
      mcpEndpoint: '/mcp',
      docs: 'https://luzia.dev/docs/mcp',
      tools: ['get_ticker', 'get_tickers', 'get_history', 'get_exchanges', 'get_markets'],
      prompts: ['analyze_price_movement', 'compare_exchanges', 'analyze_ohlcv'],
    })
  })

  // Evict idle sessions so memory stays bounded.
  const sweepTimer = setInterval(() => {
    const cutoff = Date.now() - SESSION_IDLE_MS
    for (const [id, rec] of sessions) {
      if (rec.lastSeenAt < cutoff) {
        log.info({ sessionId: id }, 'Evicting idle MCP session')
        try {
          rec.transport.close()
        } catch (error) {
          log.warn({ error, sessionId: id }, 'Error closing idle transport')
        }
        sessions.delete(id)
      }
    }
  }, SESSION_SWEEP_INTERVAL_MS)
  // Allow the process to exit even if the interval is scheduled.
  sweepTimer.unref?.()

  log.info({ port: env.server.port }, 'Starting MCP HTTP server')

  serve({
    fetch: app.fetch,
    port: env.server.port,
  })

  log.info(
    {
      port: env.server.port,
      apiUrl: env.api.url,
      allowedOrigins: env.server.allowedOrigins,
    },
    'MCP HTTP server started'
  )
}

async function startStdioServer(): Promise<void> {
  assertStdioConfig()

  const mcpServer = createMCPServer()
  const transport = new StdioServerTransport()

  log.info({}, 'Starting MCP stdio server')

  await requestContext.run({ apiKey: env.api.key as string }, async () => {
    await mcpServer.connect(transport)
  })

  log.info({}, 'MCP stdio server connected')
}

async function main(): Promise<void> {
  const useStdio = process.argv.includes('--stdio')
  if (env.server.nodeEnv !== 'test' && !useStdio) {
    // biome-ignore lint/suspicious/noConsole: Banner should print to console for visual appearance
    console.log(banner)
  }

  logger.info({ env: env.server.nodeEnv, apiUrl: env.api.url }, 'Starting Luzia MCP Server')

  if (useStdio) {
    await startStdioServer()
  } else {
    await startHTTPServer()
  }
}

let isShuttingDown = false

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    log.warn({ signal }, 'Shutdown already in progress')
    return
  }

  isShuttingDown = true
  log.info({ signal }, 'Received shutdown signal')

  try {
    log.info('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    log.error({ error }, 'Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

main().catch((error) => {
  logger.error({ error }, 'Failed to start MCP server')
  process.exit(1)
})
