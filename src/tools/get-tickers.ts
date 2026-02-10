/**
 * get_tickers Tool
 *
 * Get real-time price data for multiple cryptocurrency pairs.
 */

import { z } from 'zod'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-tickers' })

/**
 * Tool definition for MCP
 */
export const getTickersTool = {
  name: 'get_tickers',
  description:
    'Get real-time price data for multiple cryptocurrency pairs, optionally filtered by exchange or specific symbols. Returns a summary of prices with 24h changes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      exchange: {
        type: 'string',
        description: 'Filter by specific exchange (e.g., "binance", "coinbase"). Optional.',
      },
      symbols: {
        type: 'array',
        items: { type: 'string' },
        description:
          'List of specific symbols to fetch (e.g., ["BTC/USDT", "ETH/USDT"]). Optional.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of tickers to return (default: 20, max: 50)',
      },
    },
  },
}

/**
 * Input validation schema
 */
const inputSchema = z.object({
  exchange: z.string().min(1).optional(),
  symbols: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(20),
})

/**
 * Execute the get_tickers tool
 */
export async function executeGetTickers(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args)
    const { exchange, symbols, limit } = input

    log.debug({ exchange, symbols, limit }, 'Fetching tickers')

    const apiClient = getApiClient()

    // Use the filtered endpoint
    const { tickers, total } = await apiClient.getTickersFiltered({
      exchange,
      symbols,
      limit,
    })

    if (tickers.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No tickers found matching the specified criteria.',
          },
        ],
      }
    }

    // Format the response
    const response = formatTickersResponse(tickers, total)

    log.debug({ count: tickers.length }, 'Tickers fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_tickers')
    return handleToolError(error, 'get_tickers')
  }
}

/**
 * Format tickers data for AI-friendly response
 */
function formatTickersResponse(
  tickers: Array<{
    symbol: string
    exchange: string
    last: number | null
    changePercent: number | null
    volume: number | null
  }>,
  totalCount: number
): string {
  const lines: string[] = [
    `## Cryptocurrency Tickers (${tickers.length} of ${totalCount})`,
    '',
    '| Symbol | Exchange | Price | 24h Change | Volume |',
    '|--------|----------|-------|------------|--------|',
  ]

  for (const ticker of tickers) {
    const price = ticker.last !== null ? formatPrice(ticker.last) : 'N/A'
    const change = formatChange(ticker.changePercent)
    const volume = formatVolume(ticker.volume)

    lines.push(`| ${ticker.symbol} | ${ticker.exchange} | ${price} | ${change} | ${volume} |`)
  }

  lines.push('')
  lines.push(`*Showing top ${tickers.length} by volume*`)

  return lines.join('\n')
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(2)}`
  return `$${price.toFixed(6)}`
}

function formatChange(changePercent: number | null): string {
  if (changePercent === null) return 'N/A'
  const sign = changePercent >= 0 ? '+' : ''
  const emoji = changePercent >= 0 ? '🟢' : '🔴'
  return `${emoji} ${sign}${changePercent.toFixed(2)}%`
}

function formatVolume(volume: number | null): string {
  if (volume === null) return 'N/A'
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(2)}B`
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(2)}K`
  return `$${volume.toFixed(2)}`
}
