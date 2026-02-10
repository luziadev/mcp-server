/**
 * get_exchanges Tool
 *
 * List all supported cryptocurrency exchanges with their status.
 */

import { ApiError, getApiClient } from '../api-client.js'
import { createLogger } from '../logging.js'

const log = createLogger({ module: 'tool:get-exchanges' })

/**
 * Tool definition for MCP
 */
export const getExchangesTool = {
  name: 'get_exchanges',
  description: 'List all supported cryptocurrency exchanges with their current status.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
}

/**
 * Execute the get_exchanges tool
 */
export async function executeGetExchanges(): Promise<{
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}> {
  try {
    log.debug({}, 'Fetching exchanges')

    const apiClient = getApiClient()
    const exchanges = await apiClient.getExchanges()

    // Format the response
    const response = formatExchangesResponse(exchanges)

    log.debug({ count: exchanges.length }, 'Exchanges fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_exchanges')

    if (error instanceof ApiError) {
      return {
        content: [
          {
            type: 'text',
            text: `API error: ${error.details || error.message}`,
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

/**
 * Format exchanges data for AI-friendly response
 */
function formatExchangesResponse(
  exchangesList: Array<{
    id: string
    name: string
    status: string
    websiteUrl: string | null
  }>
): string {
  const lines: string[] = [
    '## Supported Cryptocurrency Exchanges',
    '',
    `Found **${exchangesList.length}** active exchanges:`,
    '',
  ]

  for (const exchange of exchangesList) {
    const statusIcon = exchange.status === 'operational' ? '🟢' : '🟠'

    lines.push(`### ${exchange.name} (\`${exchange.id}\`)`)
    lines.push(`- **Status**: ${statusIcon} ${exchange.status}`)
    if (exchange.websiteUrl) {
      lines.push(`- **Website**: ${exchange.websiteUrl}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('*Use `get_ticker` or `get_tickers` to fetch price data from these exchanges.*')

  return lines.join('\n')
}
