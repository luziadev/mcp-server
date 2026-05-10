/**
 * get_markets Tool
 *
 * List available trading pairs/markets for an exchange.
 */

import { z } from 'zod'
import { getCurrentApiKey } from '../context.js'
import { createLogger } from '../logging.js'
import { getLuziaClientForKey } from '../sdk.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-markets' })

/**
 * Tool definition for MCP
 */
export const getMarketsTool = {
  name: 'get_markets',
  description:
    'List available trading pairs (markets) for a specific exchange. Supports both centralized exchanges (e.g. "binance", "coinbase") and decentralized exchanges (e.g. "raydium-solana", "uniswapv3-ethereum"); for DEX exchanges the response includes on-chain pool address, chain, and base/quote token details. Can filter by quote currency.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      exchange: {
        type: 'string',
        description:
          'Exchange to list markets for. CEX examples: "binance", "coinbase", "kraken". DEX examples: "raydium-solana", "uniswapv3-ethereum", "uniswapv4-ethereum".',
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

    const luzia = getLuziaClientForKey(getCurrentApiKey())
    const result = await luzia.markets.list(exchange, {
      quote,
      active: true,
      limit,
    })
    const markets = result.markets ?? []
    const total = result.total ?? 0

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

interface MarketLike {
  symbol?: string
  base?: string
  quote?: string
  type?: string
  chainId?: string | null
  poolAddress?: string | null
  poolType?: string | null
  baseToken?: {
    address?: string | null
    symbol?: string
    decimals?: number
    chainId?: string | null
  } | null
  quoteToken?: {
    address?: string | null
    symbol?: string
    decimals?: number
    chainId?: string | null
  } | null
}

function formatDexMarketLines(market: MarketLike): string[] {
  const lines: string[] = [`- \`${market.symbol ?? 'N/A'}\``]
  if (market.chainId) lines.push(`  - **Chain**: ${market.chainId}`)
  if (market.poolAddress) {
    const poolType = market.poolType ? ` (${market.poolType})` : ''
    lines.push(`  - **Pool**${poolType}: \`${market.poolAddress}\``)
  }
  if (market.baseToken?.address) {
    const sym = market.baseToken.symbol ?? market.base ?? '?'
    lines.push(`  - **Base token**: ${sym} \`${market.baseToken.address}\``)
  }
  if (market.quoteToken?.address) {
    const sym = market.quoteToken.symbol ?? market.quote ?? '?'
    lines.push(`  - **Quote token**: ${sym} \`${market.quoteToken.address}\``)
  }
  return lines
}

function groupCexByQuote(markets: MarketLike[]): Map<string, Array<{ symbol: string }>> {
  const byQuote = new Map<string, Array<{ symbol: string }>>()
  for (const market of markets) {
    const quote = market.quote ?? 'UNKNOWN'
    const existing = byQuote.get(quote) ?? []
    existing.push({ symbol: market.symbol ?? 'N/A' })
    byQuote.set(quote, existing)
  }
  return byQuote
}

/**
 * Format markets data for AI-friendly response.
 *
 * DEX markets (`type === 'dex'`) get a per-pool detailed listing with chain
 * and token addresses; CEX markets are shown grouped by quote currency.
 */
function formatMarketsResponse(
  exchange: string,
  marketsList: MarketLike[],
  totalCount: number,
  quoteFilter?: string
): string {
  const dexMarkets = marketsList.filter((m) => m.type === 'dex')
  const cexMarkets = marketsList.filter((m) => m.type !== 'dex')

  const lines: string[] = [
    `## Markets on ${exchange.toUpperCase()}`,
    '',
    `Showing **${marketsList.length}** of **${totalCount}** available markets${quoteFilter ? ` (filtered by ${quoteFilter})` : ''}.`,
    '',
  ]

  if (dexMarkets.length > 0) {
    lines.push(`### DEX Pools (${dexMarkets.length})`)
    lines.push('')
    for (const m of dexMarkets) {
      lines.push(...formatDexMarketLines(m))
    }
    lines.push('')
  }

  if (cexMarkets.length > 0) {
    for (const [quoteCurrency, pairs] of groupCexByQuote(cexMarkets)) {
      lines.push(`### ${quoteCurrency} Pairs (${pairs.length})`)
      lines.push('')
      lines.push(pairs.map((p) => `\`${p.symbol}\``).join(', '))
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('*Use `get_ticker` with any of these symbols to get real-time price data.*')

  return lines.join('\n')
}
