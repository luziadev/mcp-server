/**
 * analyze_ohlcv Prompt
 *
 * Analyze OHLCV candlestick data for a trading pair.
 */

import { z } from 'zod'
import type { OhlcvCandle } from '../api-client.js'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'

const log = createLogger({ module: 'prompt:analyze-ohlcv' })

/**
 * Prompt definition for MCP
 */
export const analyzeOhlcvPrompt = {
  name: 'analyze_ohlcv',
  description:
    'Analyze OHLCV candlestick data for a cryptocurrency pair. Fetches historical candle data and asks for technical analysis including trends, support/resistance, volume patterns, and candlestick patterns.',
  arguments: [
    {
      name: 'exchange',
      description: 'Exchange to analyze (e.g., "binance", "coinbase")',
      required: true,
    },
    {
      name: 'symbol',
      description: 'Trading pair symbol (e.g., "BTC/USDT", "ETH/USD")',
      required: true,
    },
    {
      name: 'interval',
      description: 'Candle interval: "1m", "5m", "15m", "1h", "4h", "1d" (default: "1h")',
      required: false,
    },
    {
      name: 'period',
      description: 'Lookback period (e.g., "24h", "7d", "30d"). Default: "24h"',
      required: false,
    },
  ],
}

/**
 * Input validation schema
 */
const inputSchema = z.object({
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional(),
  period: z.string().optional(),
})

/**
 * Parse period string to milliseconds
 */
function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)(m|h|d)$/)
  if (!match) return 24 * 60 * 60 * 1000 // default 24h

  const value = parseInt(match[1], 10)
  switch (match[2]) {
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    default:
      return 24 * 60 * 60 * 1000
  }
}

/**
 * Generate the analyze_ohlcv prompt
 */
export async function generateAnalyzeOhlcvPrompt(args: Record<string, string>): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>
}> {
  try {
    const input = inputSchema.parse(args)
    const { exchange, symbol } = input
    const interval = input.interval || '1h'
    const period = input.period || '24h'

    log.debug({ exchange, symbol, interval, period }, 'Generating OHLCV analysis prompt')

    const periodMs = parsePeriod(period)
    const now = Date.now()

    const apiClient = getApiClient()
    const data = await apiClient.getHistory(exchange.toLowerCase(), symbol.toUpperCase(), {
      interval,
      start: now - periodMs,
      end: now,
    })

    if (!data.candles || data.candles.length === 0) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unable to fetch OHLCV data for ${symbol} on ${exchange} with interval ${interval}. Please verify the symbol and exchange are correct and try again.`,
            },
          },
        ],
      }
    }

    const promptText = buildOhlcvAnalysisPrompt(exchange, symbol, interval, period, data.candles)

    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: promptText },
        },
      ],
    }
  } catch (error) {
    log.error({ error }, 'Failed to generate OHLCV analysis prompt')

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error generating OHLCV analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    }
  }
}

/**
 * Build the analysis prompt with OHLCV data
 */
function buildOhlcvAnalysisPrompt(
  exchange: string,
  symbol: string,
  interval: string,
  period: string,
  candles: OhlcvCandle[]
): string {
  const first = candles[0]
  const last = candles[candles.length - 1]

  const highCandle = candles.reduce((max, c) => (c.high > max.high ? c : max), candles[0])
  const lowCandle = candles.reduce((min, c) => (c.low < min.low ? c : min), candles[0])
  const totalVolume = candles.reduce((sum, c) => sum + (c.volume || 0), 0)
  const avgVolume = totalVolume / candles.length

  const priceChange = last.close - first.open
  const priceChangePercent = (priceChange / first.open) * 100

  // Find volume spikes (> 2x average)
  const volumeSpikes = candles.filter((c) => c.volume > avgVolume * 2).length

  // Count bullish vs bearish candles
  const bullish = candles.filter((c) => c.close >= c.open).length
  const bearish = candles.filter((c) => c.close < c.open).length

  let candleTable = '| Time | Open | High | Low | Close | Volume |\n'
  candleTable += '|------|------|------|-----|-------|--------|\n'
  // Show up to 20 candles for analysis
  const displayCandles = candles.slice(-20)
  for (const c of displayCandles) {
    candleTable += `| ${formatTimestamp(c.timestamp)} | ${formatPrice(c.open)} | ${formatPrice(c.high)} | ${formatPrice(c.low)} | ${formatPrice(c.close)} | ${formatVolume(c.volume)} |\n`
  }

  return `Analyze the OHLCV candlestick data for ${symbol} on ${exchange.toUpperCase()}:

## Data Overview
- **Interval:** ${interval}
- **Period:** ${period} (${candles.length} candles)
- **Time Range:** ${formatTimestamp(first.timestamp)} to ${formatTimestamp(last.timestamp)}

## Summary Statistics
- **Open (first candle):** $${formatPrice(first.open)}
- **Close (last candle):** $${formatPrice(last.close)}
- **Period Change:** ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}% ($${formatPrice(Math.abs(priceChange))})
- **Period High:** $${formatPrice(highCandle.high)} at ${formatTimestamp(highCandle.timestamp)}
- **Period Low:** $${formatPrice(lowCandle.low)} at ${formatTimestamp(lowCandle.timestamp)}
- **Total Volume:** ${formatVolume(totalVolume)}
- **Average Volume/Candle:** ${formatVolume(avgVolume)}
- **Volume Spikes (>2x avg):** ${volumeSpikes}
- **Bullish Candles:** ${bullish} (${((bullish / candles.length) * 100).toFixed(0)}%)
- **Bearish Candles:** ${bearish} (${((bearish / candles.length) * 100).toFixed(0)}%)

## Recent Candle Data
${candleTable}
${candles.length > 20 ? `*Showing 20 of ${candles.length} candles*\n` : ''}
## Analysis Request
Please provide:
1. **Trend Analysis**: Is this pair trending up, down, or ranging? Identify the overall direction and strength.
2. **Support & Resistance**: Identify key price levels where the price has found support or resistance.
3. **Volume Analysis**: Analyze volume patterns. Are there notable volume spikes? What do they indicate?
4. **Candlestick Patterns**: Identify any significant candlestick patterns (doji, engulfing, hammer, etc.).
5. **Momentum**: Is momentum increasing or decreasing? Are there signs of trend exhaustion?
6. **Key Observations**: Any other noteworthy patterns or signals in the data.`
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
