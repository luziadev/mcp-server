/**
 * MCP Server Implementation
 *
 * Model Context Protocol server with HTTP/SSE transport for cryptocurrency pricing data.
 * This server acts as a thin proxy to the Luzia API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { getApiClient } from './api-client.js'
import { createLogger } from './logging.js'
import {
  analyzePricePrompt,
  compareExchangesPrompt,
  generateAnalyzePricePrompt,
  generateCompareExchangesPrompt,
} from './prompts/index.js'
import {
  executeGetExchanges,
  executeGetMarkets,
  executeGetTicker,
  executeGetTickers,
  getExchangesTool,
  getMarketsTool,
  getTickersTool,
  getTickerTool,
} from './tools/index.js'

const log = createLogger({ module: 'mcp-server' })

/**
 * Create and configure the MCP server
 */
export function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'luzia-crypto',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  )

  // Register tool handlers
  registerToolHandlers(server)

  // Register prompt handlers
  registerPromptHandlers(server)

  // Register resource handlers
  registerResourceHandlers(server)

  log.info({}, 'MCP server configured')

  return server
}

/**
 * Register tool handlers
 */
function registerToolHandlers(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log.debug({}, 'Listing tools')

    return {
      tools: [getTickerTool, getTickersTool, getExchangesTool, getMarketsTool],
    }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    log.debug({ tool: name }, 'Tool called')

    switch (name) {
      case 'get_ticker':
        return executeGetTicker(args)

      case 'get_tickers':
        return executeGetTickers(args)

      case 'get_exchanges':
        return executeGetExchanges()

      case 'get_markets':
        return executeGetMarkets(args)

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }
  })
}

/**
 * Register prompt handlers
 */
function registerPromptHandlers(server: Server): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    log.debug({}, 'Listing prompts')

    return {
      prompts: [analyzePricePrompt, compareExchangesPrompt],
    }
  })

  // Get prompt content
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    log.debug({ prompt: name }, 'Prompt requested')

    switch (name) {
      case 'analyze_price_movement':
        return generateAnalyzePricePrompt(args ?? {})

      case 'compare_exchanges':
        return generateCompareExchangesPrompt(args ?? {})

      default:
        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: `Unknown prompt: ${name}` },
            },
          ],
        }
    }
  })
}

/**
 * Register resource handlers
 */
function registerResourceHandlers(server: Server): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    log.debug({}, 'Listing resources')

    return {
      resources: [
        {
          uri: 'luzia://exchanges',
          name: 'Supported Exchanges',
          description: 'List of all supported cryptocurrency exchanges',
          mimeType: 'application/json',
        },
      ],
    }
  })

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    log.debug({ uri }, 'Resource requested')

    if (uri === 'luzia://exchanges') {
      // Fetch exchanges from API
      try {
        const apiClient = getApiClient()
        const exchanges = await apiClient.getExchanges()
        const exchangeIds = exchanges.map((e) => e.id)

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ exchanges: exchangeIds }, null, 2),
            },
          ],
        }
      } catch (error) {
        log.error({ error }, 'Failed to fetch exchanges for resource')
        // Fallback to static list
        const exchanges = ['binance', 'coinbase', 'kraken']
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ exchanges }, null, 2),
            },
          ],
        }
      }
    }

    // Handle dynamic ticker resources: luzia://ticker/{exchange}/{symbol}
    const tickerMatch = uri.match(/^luzia:\/\/ticker\/([^/]+)\/([^/]+)$/)
    if (tickerMatch) {
      const [, exchange, symbol] = tickerMatch
      const normalizedSymbol = symbol.replace('-', '/')

      try {
        const apiClient = getApiClient()
        const ticker = await apiClient.getTicker(exchange, normalizedSymbol)

        if (ticker) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(ticker, null, 2),
              },
            ],
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Ticker not found for ${normalizedSymbol} on ${exchange}`,
            },
          ],
        }
      } catch (error) {
        log.error({ error, exchange, symbol: normalizedSymbol }, 'Failed to fetch ticker resource')
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error fetching ticker for ${normalizedSymbol} on ${exchange}`,
            },
          ],
        }
      }
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Unknown resource: ${uri}`,
        },
      ],
    }
  })
}
