/**
 * get_history Tool
 *
 * Get historical OHLCV candlestick data for a cryptocurrency trading pair.
 */

import type { OHLCVCandle } from '@luziadev/sdk'
import { z } from 'zod'
import { getCurrentApiKey } from '../context.js'
import { createLogger } from '../logging.js'
import { getLuziaClientForKey } from '../sdk.js'
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
        description: 'Candle interval: "1m", "5m", "15m", "1h", "1d" (default: "1h")',
        enum: ['1m', '5m', '15m', '1h', '1d'],
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
  interval: z.enum(['1m', '5m', '15m', '1h', '1d']).optional(),
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

    const luzia = getLuziaClientForKey(getCurrentApiKey())
    const data = await luzia.history.get(exchange.toLowerCase(), symbol.toUpperCase(), {
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
      data.exchange ?? exchange,
      data.symbol ?? symbol,
      data.interval ?? interval ?? '1h',
      data.candles,
      data.start ?? '',
      data.end ?? ''
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
  candles: OHLCVCandle[],
  start: string,
  end: string
): string {
  const first = candles[0]
  const last = candles[candles.length - 1]

  const highCandle = candles.reduce(
    (max, c) => ((c.high ?? 0) > (max.high ?? 0) ? c : max),
    candles[0]
  )
  const lowCandle = candles.reduce(
    (min, c) => ((c.low ?? 0) < (min.low ?? Infinity) ? c : min),
    candles[0]
  )
  const totalVolume = candles.reduce((sum, c) => sum + (c.volume ?? 0), 0)
  const totalQuoteVolume = candles.reduce((sum, c) => sum + (c.quoteVolume ?? 0), 0)

  const firstOpen = first.open ?? 0
  const lastClose = last.close ?? 0
  const priceChange = lastClose - firstOpen
  const priceChangePercent = firstOpen > 0 ? (priceChange / firstOpen) * 100 : 0

  const lines: string[] = [
    `## ${symbol} OHLCV on ${exchange.toUpperCase()}`,
    '',
    `**Interval:** ${interval} | **Candles:** ${candles.length} | **Range:** ${formatTimestamp(start)} to ${formatTimestamp(end)}`,
    '',
    '### Summary',
    `- **Open (first):** ${formatPrice(firstOpen)}`,
    `- **Close (last):** ${formatPrice(lastClose)}`,
    `- **Period Change:** ${formatChange(priceChange, priceChangePercent)}`,
    `- **Period High:** ${formatPrice(highCandle.high ?? 0)} (${formatTimestamp(highCandle.timestamp ?? '')})`,
    `- **Period Low:** ${formatPrice(lowCandle.low ?? 0)} (${formatTimestamp(lowCandle.timestamp ?? '')})`,
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
      `| ${formatTimestamp(c.timestamp ?? '')} | ${formatPrice(c.open ?? 0)} | ${formatPrice(c.high ?? 0)} | ${formatPrice(c.low ?? 0)} | ${formatPrice(c.close ?? 0)} | ${formatVolume(c.volume ?? 0)} |`
    )
  }

  if (candles.length > 10) {
    lines.push('', `*Showing 10 of ${candles.length} candles*`)
  }

  return lines.join('\n')
}

function formatTimestamp(ts: string): string {
  if (!ts) return 'N/A'
  return ts.replace('T', ' ').replace(/\.\d+Z$/, 'Z')
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
