/**
 * get_exchanges Tool
 *
 * List all supported cryptocurrency exchanges with their status.
 */

import { LuziaError } from '@luziadev/sdk'
import { getCurrentApiKey } from '../context.js'
import { createLogger } from '../logging.js'
import { getLuziaClientForKey } from '../sdk.js'

const log = createLogger({ module: 'tool:get-exchanges' })

/**
 * Tool definition for MCP
 */
export const getExchangesTool = {
  name: 'get_exchanges',
  description:
    'List supported exchanges with their current status. Includes both centralized exchanges (CEX, e.g. Binance, Coinbase) and decentralized exchanges (DEX, e.g. Uniswap V3/V4, Raydium). Pass type="cex" or type="dex" to filter.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['cex', 'dex'],
        description: 'Filter by exchange kind. Omit to include both.',
      },
    },
  },
}

/**
 * Execute the get_exchanges tool
 */
export async function executeGetExchanges(args?: unknown): Promise<{
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}> {
  try {
    const typeFilter = parseExchangeType(args)
    log.debug({ typeFilter }, 'Fetching exchanges')

    const luzia = getLuziaClientForKey(getCurrentApiKey())
    const exchanges = await luzia.exchanges.list(typeFilter ? { type: typeFilter } : {})

    // Format the response
    const response = formatExchangesResponse(exchanges, typeFilter)

    log.debug({ count: exchanges.length }, 'Exchanges fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_exchanges')

    if (error instanceof LuziaError) {
      return {
        content: [
          {
            type: 'text',
            text: `API error: ${error.message}`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error fetching exchanges: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    }
  }
}

function parseExchangeType(args: unknown): 'cex' | 'dex' | undefined {
  if (!args || typeof args !== 'object') return undefined
  const t = (args as { type?: unknown }).type
  if (t === 'cex' || t === 'dex') return t
  return undefined
}

interface ExchangeLike {
  id?: string
  name?: string
  status?: string
  websiteUrl?: string | null
  type?: 'cex' | 'dex'
  chainId?: string | null
  dexId?: string | null
}

function formatExchangeLines(exchange: ExchangeLike): string[] {
  const statusIcon = exchange.status === 'operational' ? '🟢' : '🟠'
  const kindBadge = exchange.type ? ` _[${exchange.type.toUpperCase()}]_` : ''
  const lines: string[] = [
    `### ${exchange.name ?? 'Unknown'} (\`${exchange.id ?? 'unknown'}\`)${kindBadge}`,
    `- **Status**: ${statusIcon} ${exchange.status ?? 'unknown'}`,
  ]
  if (exchange.type === 'dex') {
    if (exchange.chainId) lines.push(`- **Chain**: ${exchange.chainId}`)
    if (exchange.dexId) lines.push(`- **Protocol**: ${exchange.dexId}`)
  }
  if (exchange.websiteUrl) lines.push(`- **Website**: ${exchange.websiteUrl}`)
  lines.push('')
  return lines
}

/**
 * Format exchanges data for AI-friendly response
 */
function formatExchangesResponse(
  exchangesList: ExchangeLike[],
  typeFilter?: 'cex' | 'dex'
): string {
  const heading = typeFilter
    ? `## Supported ${typeFilter.toUpperCase()} Exchanges`
    : '## Supported Cryptocurrency Exchanges'

  const lines: string[] = [heading, '', `Found **${exchangesList.length}** active exchanges:`, '']
  for (const exchange of exchangesList) lines.push(...formatExchangeLines(exchange))

  lines.push('---')
  lines.push('*Use `get_ticker` or `get_tickers` to fetch price data from these exchanges.*')

  return lines.join('\n')
}
