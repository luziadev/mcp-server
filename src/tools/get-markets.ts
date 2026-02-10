/**
 * get_markets Tool
 *
 * List available trading pairs/markets for an exchange.
 */

import { z } from 'zod'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-markets' })

/**
 * Tool definition for MCP
 */
export const getMarketsTool = {
  name: 'get_markets',
  description:
    'List available trading pairs (markets) for a specific exchange. Can filter by quote currency.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      exchange: {
        type: 'string',
        description: 'Exchange to list markets for (e.g., "binance", "coinbase", "kraken")',
      },
      quote: {
        type: 'string',
        description: 'Filter by quote currency (e.g., "USDT", "USD", "BTC"). Optional.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of markets to return (default: 50, max: 100)',
      },
    },
    required: ['exchange'],
  },
}

/**
 * Input validation schema
 */
const inputSchema = z.object({
  exchange: z.string().min(1),
  quote: z.string().min(1).optional(),
  limit: z.number().min(1).max(100).default(50),
})

/**
 * Execute the get_markets tool
 */
export async function executeGetMarkets(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args)
    const { exchange, quote, limit } = input

    log.debug({ exchange, quote, limit }, 'Fetching markets')

    const apiClient = getApiClient()
    const { markets, total } = await apiClient.getMarkets(exchange, {
      quote,
      active: true,
      limit,
    })

    if (markets.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No markets found for exchange "${exchange}"${quote ? ` with quote currency "${quote}"` : ''}.`,
          },
        ],
      }
    }

    // Format the response
    const response = formatMarketsResponse(exchange, markets, total, quote)

    log.debug({ exchange, count: markets.length }, 'Markets fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_markets')
    return handleToolError(error, 'get_markets')
  }
}

/**
 * Format markets data for AI-friendly response
 */
function formatMarketsResponse(
  exchange: string,
  marketsList: Array<{
    symbol: string
    base: string
    quote: string
  }>,
  totalCount: number,
  quoteFilter?: string
): string {
  // Group markets by quote currency
  const byQuote = new Map<string, Array<{ symbol: string; base: string }>>()

  for (const market of marketsList) {
    const existing = byQuote.get(market.quote) ?? []
    existing.push({ symbol: market.symbol, base: market.base })
    byQuote.set(market.quote, existing)
  }

  const lines: string[] = [
    `## Markets on ${exchange.toUpperCase()}`,
    '',
    `Showing **${marketsList.length}** of **${totalCount}** available markets${quoteFilter ? ` (filtered by ${quoteFilter})` : ''}.`,
    '',
  ]

  // Show markets grouped by quote currency
  for (const [quoteCurrency, pairs] of byQuote) {
    lines.push(`### ${quoteCurrency} Pairs (${pairs.length})`)
    lines.push('')

    // Show as a comma-separated list for readability
    const symbols = pairs.map((p) => `\`${p.symbol}\``).join(', ')
    lines.push(symbols)
    lines.push('')
  }

  lines.push('---')
  lines.push('*Use `get_ticker` with any of these symbols to get real-time price data.*')

  return lines.join('\n')
}
