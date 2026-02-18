/**
 * get_ticker Tool
 *
 * Get real-time price data for a specific cryptocurrency trading pair on a given exchange.
 */

import { z } from 'zod'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-ticker' })

/**
 * Tool definition for MCP
 */
export const getTickerTool = {
  name: 'get_ticker',
  description:
    'Get real-time price data for a specific cryptocurrency trading pair on a given exchange. Returns current price, bid/ask, 24h high/low, volume, and percentage change.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      exchange: {
        type: 'string',
        description: 'Exchange to fetch ticker from (e.g., "binance", "coinbase", "kraken")',
      },
      symbol: {
        type: 'string',
        description: 'Trading pair symbol in normalized format (e.g., "BTC/USDT", "ETH/USD")',
      },
    },
    required: ['exchange', 'symbol'],
  },
}

/**
 * Input validation schema
 */
const inputSchema = z.object({
  exchange: z.string().min(1),
  symbol: z.string().min(1),
})

/**
 * Execute the get_ticker tool
 */
export async function executeGetTicker(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args)
    const { exchange, symbol } = input

    log.debug({ exchange, symbol }, 'Fetching ticker')

    const apiClient = getApiClient()
    const ticker = await apiClient.getTicker(exchange.toLowerCase(), symbol.toUpperCase())

    if (!ticker) {
      return {
        content: [
          {
            type: 'text',
            text: `Ticker not found for ${symbol} on ${exchange}. The symbol may not be available or the exchange may be temporarily unavailable.`,
          },
        ],
        isError: true,
      }
    }

    // Format the ticker data for AI consumption
    const response = formatTickerResponse(ticker)

    log.debug({ exchange, symbol }, 'Ticker fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_ticker')
    return handleToolError(error, 'get_ticker')
  }
}

/**
 * Format ticker data for AI-friendly response
 */
function formatTickerResponse(ticker: {
  symbol: string
  exchange: string
  last: number | null
  bid: number | null
  ask: number | null
  high: number | null
  low: number | null
  open: number | null
  volume: number | null
  quoteVolume: number | null
  change: number | null
  changePercent: number | null
  timestamp: string
}): string {
  const lines: string[] = [
    `## ${ticker.symbol} on ${ticker.exchange.toUpperCase()}`,
    '',
    '### Current Price',
    `- **Last**: ${formatPrice(ticker.last)}`,
    `- **Bid**: ${formatPrice(ticker.bid)}`,
    `- **Ask**: ${formatPrice(ticker.ask)}`,
    '',
    '### 24h Statistics',
    `- **High**: ${formatPrice(ticker.high)}`,
    `- **Low**: ${formatPrice(ticker.low)}`,
    `- **Open**: ${formatPrice(ticker.open)}`,
    `- **Change**: ${formatChange(ticker.change, ticker.changePercent)}`,
    '',
    '### Volume',
    `- **Base Volume**: ${formatVolume(ticker.volume)}`,
    `- **Quote Volume**: ${formatVolume(ticker.quoteVolume)}`,
    '',
    `*Last updated: ${ticker.timestamp}*`,
  ]

  return lines.join('\n')
}

function formatPrice(price: number | null): string {
  if (price === null) return 'N/A'
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
}

function formatVolume(volume: number | null): string {
  if (volume === null) return 'N/A'
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`
  return volume.toFixed(2)
}

function formatChange(change: number | null, changePercent: number | null): string {
  if (changePercent === null) return 'N/A'
  const sign = changePercent >= 0 ? '+' : ''
  const emoji = changePercent >= 0 ? '📈' : '📉'
  return `${sign}${changePercent.toFixed(2)}% ${emoji}${change !== null ? ` (${sign}${formatPrice(change)})` : ''}`
}
