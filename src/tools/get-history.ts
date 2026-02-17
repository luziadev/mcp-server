/**
 * get_history Tool
 *
 * Get historical OHLCV candlestick data for a cryptocurrency trading pair.
 */

import { z } from 'zod'
import type { OhlcvCandle } from '../api-client.js'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-history' })

/**
 * Tool definition for MCP
 */
export const getHistoryTool = {
  name: 'get_history',
  description:
    'Get historical OHLCV (Open, High, Low, Close, Volume) candlestick data for a cryptocurrency trading pair. Returns time-series candle data useful for technical analysis, charting, and trend detection.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      exchange: {
        type: 'string',
        description: 'Exchange to fetch history from (e.g., "binance", "coinbase", "kraken")',
      },
      symbol: {
        type: 'string',
        description: 'Trading pair symbol in normalized format (e.g., "BTC/USDT", "ETH/USD")',
      },
      interval: {
        type: 'string',
        description: 'Candle interval: "1m", "5m", "15m", "1h", "4h", "1d" (default: "1h")',
        enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
      },
      start: {
        type: 'number',
        description: 'Start timestamp in Unix milliseconds (default: 24h ago)',
      },
      end: {
        type: 'number',
        description: 'End timestamp in Unix milliseconds (default: now)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of candles to return (default: 300, max: 500)',
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
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  limit: z.number().min(1).max(500).optional(),
})

/**
 * Execute the get_history tool
 */
export async function executeGetHistory(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args)
    const { exchange, symbol, interval, start, end, limit } = input

    log.debug({ exchange, symbol, interval }, 'Fetching history')

    const apiClient = getApiClient()
    const data = await apiClient.getHistory(exchange.toLowerCase(), symbol.toUpperCase(), {
      interval,
      start,
      end,
      limit,
    })

    if (!data.candles || data.candles.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No candle data found for ${symbol} on ${exchange} with interval ${interval || '1h'}. The symbol may not have history data yet or the time range may be empty.`,
          },
        ],
      }
    }

    const response = formatHistoryResponse(
      data.exchange,
      data.symbol,
      data.interval,
      data.candles,
      data.start,
      data.end
    )

    log.debug({ exchange, symbol, count: data.count }, 'History fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_history')
    return handleToolError(error, 'get_history')
  }
}

/**
 * Format history data for AI-friendly response
 */
function formatHistoryResponse(
  exchange: string,
  symbol: string,
  interval: string,
  candles: OhlcvCandle[],
  start: number,
  end: number
): string {
  const first = candles[0]
  const last = candles[candles.length - 1]

  const highCandle = candles.reduce((max, c) => (c.high > max.high ? c : max), candles[0])
  const lowCandle = candles.reduce((min, c) => (c.low < min.low ? c : min), candles[0])
  const totalVolume = candles.reduce((sum, c) => sum + (c.volume || 0), 0)
  const totalQuoteVolume = candles.reduce((sum, c) => sum + (c.quoteVolume || 0), 0)

  const priceChange = last.close - first.open
  const priceChangePercent = (priceChange / first.open) * 100

  const lines: string[] = [
    `## ${symbol} OHLCV on ${exchange.toUpperCase()}`,
    '',
    `**Interval:** ${interval} | **Candles:** ${candles.length} | **Range:** ${formatTimestamp(start)} to ${formatTimestamp(end)}`,
    '',
    '### Summary',
    `- **Open (first):** ${formatPrice(first.open)}`,
    `- **Close (last):** ${formatPrice(last.close)}`,
    `- **Period Change:** ${formatChange(priceChange, priceChangePercent)}`,
    `- **Period High:** ${formatPrice(highCandle.high)} (${formatTimestamp(highCandle.timestamp)})`,
    `- **Period Low:** ${formatPrice(lowCandle.low)} (${formatTimestamp(lowCandle.timestamp)})`,
    `- **Total Volume:** ${formatVolume(totalVolume)}`,
    `- **Total Quote Volume:** ${formatVolume(totalQuoteVolume)}`,
    '',
    '### Candle Data (most recent 10)',
    '',
    '| Time | Open | High | Low | Close | Volume |',
    '|------|------|------|-----|-------|--------|',
  ]

  // Show up to 10 most recent candles
  const recentCandles = candles.slice(-10)
  for (const c of recentCandles) {
    lines.push(
      `| ${formatTimestamp(c.timestamp)} | ${formatPrice(c.open)} | ${formatPrice(c.high)} | ${formatPrice(c.low)} | ${formatPrice(c.close)} | ${formatVolume(c.volume)} |`
    )
  }

  if (candles.length > 10) {
    lines.push('', `*Showing 10 of ${candles.length} candles*`)
  }

  return lines.join('\n')
}

function formatTimestamp(ts: number): string {
  return new Date(ts)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, 'Z')
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`
  return volume.toFixed(2)
}

function formatChange(change: number, changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : ''
  const emoji = changePercent >= 0 ? '📈' : '📉'
  return `${sign}${changePercent.toFixed(2)}% ${emoji} (${sign}${formatPrice(change)})`
}
