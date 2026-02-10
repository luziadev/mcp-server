/**
 * analyze_price_movement Prompt
 *
 * Analyze recent price changes for a trading pair.
 */

import { z } from 'zod'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'

const log = createLogger({ module: 'prompt:analyze-price' })

/**
 * Prompt definition for MCP
 */
export const analyzePricePrompt = {
  name: 'analyze_price_movement',
  description:
    'Analyze the recent price movement and provide insights for a cryptocurrency pair. Returns current data with analysis context.',
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
  ],
}

/**
 * Input validation schema
 */
const inputSchema = z.object({
  exchange: z.string().min(1),
  symbol: z.string().min(1),
})

/**
 * Generate the analyze_price_movement prompt
 */
export async function generateAnalyzePricePrompt(args: Record<string, string>): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>
}> {
  try {
    const input = inputSchema.parse(args)
    const { exchange, symbol } = input

    log.debug({ exchange, symbol }, 'Generating price analysis prompt')

    const apiClient = getApiClient()
    const ticker = await apiClient.getTicker(exchange.toLowerCase(), symbol.toUpperCase())

    if (!ticker) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unable to fetch data for ${symbol} on ${exchange}. Please verify the symbol and exchange are correct and try again.`,
            },
          },
        ],
      }
    }

    // Build the analysis prompt with current data
    const promptText = buildAnalysisPrompt(ticker)

    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: promptText },
        },
      ],
    }
  } catch (error) {
    log.error({ error }, 'Failed to generate price analysis prompt')

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error generating analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    }
  }
}

/**
 * Build the analysis prompt with ticker data
 */
function buildAnalysisPrompt(ticker: {
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
  timestamp: number
}): string {
  const spread = ticker.bid && ticker.ask ? ((ticker.ask - ticker.bid) / ticker.ask) * 100 : null
  const range = ticker.high && ticker.low ? ((ticker.high - ticker.low) / ticker.low) * 100 : null

  return `Analyze the price movement for ${ticker.symbol} on ${ticker.exchange.toUpperCase()}:

## Current Price Data
- **Last Price**: ${formatPrice(ticker.last)}
- **Bid**: ${formatPrice(ticker.bid)}
- **Ask**: ${formatPrice(ticker.ask)}
- **Spread**: ${spread !== null ? `${spread.toFixed(4)}%` : 'N/A'}

## 24-Hour Statistics
- **Open**: ${formatPrice(ticker.open)}
- **High**: ${formatPrice(ticker.high)}
- **Low**: ${formatPrice(ticker.low)}
- **24h Range**: ${range !== null ? `${range.toFixed(2)}%` : 'N/A'}
- **24h Change**: ${formatChange(ticker.change, ticker.changePercent)}

## Volume
- **Base Volume**: ${formatVolume(ticker.volume)}
- **Quote Volume**: ${formatVolume(ticker.quoteVolume)}

## Analysis Request
Please provide:
1. **Trend Assessment**: Is this pair bullish, bearish, or neutral based on the 24h data?
2. **Key Levels**: Identify potential support (near the low) and resistance (near the high) levels.
3. **Volume Analysis**: Is the trading volume significant? What does it suggest about market interest?
4. **Spread Analysis**: Is the bid-ask spread tight or wide? What does this indicate about liquidity?
5. **Risk Considerations**: What should traders be aware of when considering this pair?

*Data timestamp: ${new Date(ticker.timestamp).toISOString()}*`
}

function formatPrice(price: number | null): string {
  if (price === null) return 'N/A'
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
}

function formatChange(change: number | null, changePercent: number | null): string {
  if (changePercent === null) return 'N/A'
  const sign = changePercent >= 0 ? '+' : ''
  const emoji = changePercent >= 0 ? '📈' : '📉'
  return `${sign}${changePercent.toFixed(2)}% ${emoji}${change !== null ? ` (${sign}$${Math.abs(change).toFixed(2)})` : ''}`
}

function formatVolume(volume: number | null): string {
  if (volume === null) return 'N/A'
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(2)}B`
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(2)}K`
  return `$${volume.toFixed(2)}`
}
