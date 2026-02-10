/**
 * compare_exchanges Prompt
 *
 * Compare prices across multiple exchanges for arbitrage opportunities.
 */

import { z } from 'zod'
import { getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'

const log = createLogger({ module: 'prompt:compare-exchanges' })

/**
 * Prompt definition for MCP
 */
export const compareExchangesPrompt = {
  name: 'compare_exchanges',
  description:
    'Compare prices for a cryptocurrency pair across multiple exchanges to identify price differences and potential arbitrage opportunities.',
  arguments: [
    {
      name: 'symbol',
      description: 'Trading pair symbol to compare (e.g., "BTC/USDT", "ETH/USD")',
      required: true,
    },
    {
      name: 'exchanges',
      description:
        'Comma-separated list of exchanges to compare (e.g., "binance,coinbase,kraken"). If not provided, compares all available.',
      required: false,
    },
  ],
}

const DEFAULT_EXCHANGES = ['binance', 'coinbase', 'kraken']

/**
 * Input validation schema
 */
const inputSchema = z.object({
  symbol: z.string().min(1),
  exchanges: z.string().optional(),
})

/**
 * Generate the compare_exchanges prompt
 */
export async function generateCompareExchangesPrompt(args: Record<string, string>): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>
}> {
  try {
    const input = inputSchema.parse(args)
    const { symbol, exchanges: exchangesStr } = input

    const exchangeList = exchangesStr
      ? exchangesStr.split(',').map((e) => e.trim().toLowerCase())
      : DEFAULT_EXCHANGES

    log.debug({ symbol, exchanges: exchangeList }, 'Generating exchange comparison prompt')

    const apiClient = getApiClient()

    // Fetch ticker from each exchange
    const tickerResults: Array<{
      exchange: string
      last: number | null
      bid: number | null
      ask: number | null
      volume: number | null
      changePercent: number | null
      available: boolean
    }> = []

    for (const exchange of exchangeList) {
      const ticker = await apiClient.getTicker(exchange, symbol.toUpperCase())
      tickerResults.push({
        exchange,
        last: ticker?.last ?? null,
        bid: ticker?.bid ?? null,
        ask: ticker?.ask ?? null,
        volume: ticker?.volume ?? null,
        changePercent: ticker?.changePercent ?? null,
        available: ticker !== null,
      })
    }

    const availableTickers = tickerResults.filter((t) => t.available)

    if (availableTickers.length === 0) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unable to fetch ${symbol} data from any of the specified exchanges (${exchangeList.join(', ')}). Please verify the symbol is available on these exchanges.`,
            },
          },
        ],
      }
    }

    // Build the comparison prompt
    const promptText = buildComparisonPrompt(symbol, tickerResults)

    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: promptText },
        },
      ],
    }
  } catch (error) {
    log.error({ error }, 'Failed to generate exchange comparison prompt')

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error generating comparison: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
      ],
    }
  }
}

/**
 * Build the comparison prompt with ticker data
 */
function buildComparisonPrompt(
  symbol: string,
  tickers: Array<{
    exchange: string
    last: number | null
    bid: number | null
    ask: number | null
    volume: number | null
    changePercent: number | null
    available: boolean
  }>
): string {
  const availableTickers = tickers.filter((t) => t.available && t.last !== null)

  // Calculate price differences (we filtered for t.last !== null above)
  const prices = availableTickers.map((t) => ({ exchange: t.exchange, price: t.last as number }))
  const minPrice = Math.min(...prices.map((p) => p.price))
  const maxPrice = Math.max(...prices.map((p) => p.price))
  const priceDiff = maxPrice - minPrice
  const priceDiffPercent = (priceDiff / minPrice) * 100

  const minExchange = prices.find((p) => p.price === minPrice)?.exchange ?? 'unknown'
  const maxExchange = prices.find((p) => p.price === maxPrice)?.exchange ?? 'unknown'

  let tableRows = ''
  for (const ticker of tickers) {
    const status = ticker.available ? '✅' : '❌'
    const price = ticker.last !== null ? formatPrice(ticker.last) : 'N/A'
    const bid = ticker.bid !== null ? formatPrice(ticker.bid) : 'N/A'
    const ask = ticker.ask !== null ? formatPrice(ticker.ask) : 'N/A'
    const change = formatChange(ticker.changePercent)
    const volume = formatVolume(ticker.volume)

    tableRows += `| ${ticker.exchange.toUpperCase()} | ${status} | ${price} | ${bid} | ${ask} | ${change} | ${volume} |\n`
  }

  return `Compare ${symbol} prices across exchanges for potential arbitrage opportunities:

## Price Comparison Table

| Exchange | Status | Last Price | Bid | Ask | 24h Change | Volume |
|----------|--------|------------|-----|-----|------------|--------|
${tableRows}

## Price Spread Analysis
- **Lowest Price**: ${formatPrice(minPrice)} on ${minExchange.toUpperCase()}
- **Highest Price**: ${formatPrice(maxPrice)} on ${maxExchange.toUpperCase()}
- **Price Difference**: ${formatPrice(priceDiff)} (${priceDiffPercent.toFixed(3)}%)

## Analysis Request
Please analyze:
1. **Arbitrage Opportunity**: Is the ${priceDiffPercent.toFixed(3)}% price difference significant enough for arbitrage after accounting for:
   - Trading fees (typically 0.1% per trade on most exchanges)
   - Withdrawal fees
   - Transfer time risks
   - Slippage on larger orders

2. **Best Execution**: Which exchange offers the best price for:
   - Buying ${symbol.split('/')[0]}
   - Selling ${symbol.split('/')[0]}

3. **Liquidity Comparison**: Based on volume, which exchange has the best liquidity?

4. **Risk Assessment**: What are the risks of executing arbitrage between these exchanges?

5. **Recommendations**: Should a trader consider this arbitrage opportunity? Why or why not?`
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
}

function formatChange(changePercent: number | null): string {
  if (changePercent === null) return 'N/A'
  const sign = changePercent >= 0 ? '+' : ''
  return `${sign}${changePercent.toFixed(2)}%`
}

function formatVolume(volume: number | null): string {
  if (volume === null) return 'N/A'
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(2)}B`
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(2)}K`
  return `$${volume.toFixed(2)}`
}
