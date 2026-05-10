/**
 * get_fiat_currencies Tool
 *
 * List ISO 4217 fiat currencies referenced by markets (USD, EUR, GBP, ...).
 */

import { z } from 'zod'
import { getCurrentApiKey } from '../context.js'
import { createLogger } from '../logging.js'
import { getLuziaClientForKey } from '../sdk.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-fiat-currencies' })

export const getFiatCurrenciesTool = {
  name: 'get_fiat_currencies',
  description:
    'List ISO 4217 fiat currencies referenced by Luzia markets (USD, EUR, GBP, BRL, JPY, ...). Stablecoins like USDC and USDT are tokens, not fiat — use get_tokens for those.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      search: {
        type: 'string',
        description: 'Case-insensitive search across code and name.',
      },
      enabled: {
        type: 'string',
        enum: ['all', 'true', 'false'],
        description:
          '"true" returns enabled only (default), "false" disabled only, "all" for both.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of currencies to return (default: 50, max: 200).',
      },
    },
  },
}

const inputSchema = z.object({
  search: z.string().min(1).optional(),
  enabled: z.enum(['all', 'true', 'false']).default('true'),
  limit: z.number().min(1).max(200).default(50),
})

interface FiatLike {
  code?: string
  name?: string
  symbol?: string | null
  enabled?: boolean
}

function formatResponse(currencies: FiatLike[], total: number): string {
  if (currencies.length === 0) {
    return 'No fiat currencies match the given filters.'
  }
  const lines: string[] = [
    '## Fiat Currencies',
    '',
    `Showing **${currencies.length}** of **${total}** matching fiat currencies.`,
    '',
    '| Code | Name | Symbol | Enabled |',
    '|------|------|--------|---------|',
  ]
  for (const f of currencies) {
    const status = f.enabled ? '✓' : '—'
    lines.push(`| \`${f.code ?? '?'}\` | ${f.name ?? '?'} | ${f.symbol ?? ''} | ${status} |`)
  }
  return lines.join('\n')
}

export async function executeGetFiatCurrencies(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args ?? {})
    const luzia = getLuziaClientForKey(getCurrentApiKey())

    log.debug({ input }, 'Fetching fiat currencies')

    const result = await luzia.fiatCurrencies.list({
      search: input.search,
      enabled: input.enabled === 'all' ? 'all' : input.enabled === 'true',
      limit: input.limit,
    })

    return {
      content: [{ type: 'text', text: formatResponse(result.data, result.pagination?.total ?? 0) }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_fiat_currencies')
    return handleToolError(error, 'get_fiat_currencies')
  }
}
