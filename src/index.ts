#!/usr/bin/env bun
/**
 * Luzia MCP Server
 *
 * Model Context Protocol server for cryptocurrency pricing data.
 * Provides tools for fetching real-time ticker prices, exchanges, and markets.
 *
 * This server acts as a thin proxy to the Luzia API, forwarding all
 * tool calls to the API and returning the results.
 *
 * Supports:
 * - HTTP/SSE transport for web clients (Streamable HTTP)
 * - stdio transport for Claude Desktop
 *
 * Authentication:
 * - Uses API key to authenticate with the Luzia API
 * - No authentication required for MCP clients (API handles auth)
 */

import { serve } from '@hono/node-server'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { env } from './config.js'
import { createLogger, logger } from './logging.js'
import { createMCPServer } from './server.js'

const log = createLogger({ module: 'main' })

// Startup banner
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

/**
 * Start the MCP server with HTTP/SSE transport (Streamable HTTP)
 */
async function startHTTPServer(): Promise<void> {
  const app = new Hono()

  // Store active sessions and their transports
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>()

  /**
   * MCP endpoint - handles all MCP communication
   * No authentication at this layer - the Luzia API handles auth via API key
   * Uses Streamable HTTP transport for web standard environments (Bun/Deno/Workers)
   */
  app.all('/mcp', async (c) => {
    const sessionId = c.req.header('mcp-session-id')

    // Check for existing session
    let transport = sessionId ? sessions.get(sessionId) : undefined

    if (!transport) {
      // Create new transport for this session
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          log.info({ sessionId: newSessionId }, 'MCP session initialized')
          if (transport) {
            sessions.set(newSessionId, transport)
          }
        },
        onsessionclosed: (closedSessionId) => {
          log.info({ sessionId: closedSessionId }, 'MCP session closed')
          sessions.delete(closedSessionId)
        },
      })

      // Connect to MCP server
      const mcpServer = createMCPServer()
      await mcpServer.connect(transport)
    }

    // Handle the request using web standard APIs
    return transport.handleRequest(c.req.raw)
  })

  /**
   * Health check endpoint (no auth required)
   */
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      server: 'luzia-mcp',
      version: '1.0.0',
      activeSessions: sessions.size,
      apiUrl: env.api.url,
    })
  })

  /**
   * Server info endpoint (no auth required)
   */
  app.get('/', (c) => {
    return c.json({
      name: 'Luzia MCP Server',
      version: '1.0.0',
      description: 'Model Context Protocol server for cryptocurrency pricing data',
      transport: 'Streamable HTTP (SSE)',
      note: 'This server proxies requests to the Luzia API',
      endpoints: {
        mcp: '/mcp',
        health: '/health',
      },
      tools: ['get_ticker', 'get_tickers', 'get_exchanges', 'get_markets'],
      prompts: ['analyze_price_movement', 'compare_exchanges'],
    })
  })

  // Start the HTTP server using @hono/node-server for Node.js compatibility
  log.info({ port: env.server.port }, 'Starting MCP HTTP/SSE server')

  serve({
    fetch: app.fetch,
    port: env.server.port,
  })

  log.info({ port: env.server.port, apiUrl: env.api.url }, 'MCP HTTP/SSE server started')
}

/**
 * Start the MCP server with stdio transport (for Claude Desktop)
 */
async function startStdioServer(): Promise<void> {
  const mcpServer = createMCPServer()
  const transport = new StdioServerTransport()

  log.info({}, 'Starting MCP stdio server')

  await mcpServer.connect(transport)

  log.info({}, 'MCP stdio server connected')
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Print startup banner (skip in stdio mode - stdout must be pure JSON-RPC)
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

// Graceful shutdown
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

// Run the server
main().catch((error) => {
  logger.error({ error }, 'Failed to start MCP server')
  process.exit(1)
})
