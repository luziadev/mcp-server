/**
 * get_tokens Tool
 *
 * List canonical assets and on-chain tokens, with search and chain filters.
 */

import { z } from 'zod'
import { getCurrentApiKey } from '../context.js'
import { createLogger } from '../logging.js'
import { getLuziaClientForKey } from '../sdk.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-tokens' })

export const getTokensTool = {
  name: 'get_tokens',
  description:
    'List Luzia tokens. Each row is either a chainless canonical asset (id "crypto:SYMBOL") or an on-chain instance (id "{chain}:SYMBOL", e.g. "ethereum:WETH"). Stablecoins like USDC are tokens with the "stablecoin" tag. Use search to find by symbol or name; chain to filter by blockchain. For ISO 4217 fiat (USD, EUR, ...) use get_fiat_currencies instead.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      search: {
        type: 'string',
        description: 'Case-insensitive search across symbol, name, and id.',
      },
      chain: {
        type: 'string',
        description: 'Filter by chain id (e.g. "ethereum", "solana"). Omit for all chains.',
      },
      hasChain: {
        type: 'string',
        enum: ['true', 'false'],
        description:
          '"true" returns on-chain tokens only, "false" returns chainless canonical tokens only. Omit for both.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of tokens to return (default: 20, max: 100).',
      },
    },
  },
}

const inputSchema = z.object({
  search: z.string().min(1).optional(),
  chain: z.string().min(1).optional(),
  hasChain: z.enum(['true', 'false']).optional(),
  limit: z.number().min(1).max(100).default(20),
})

interface TokenLike {
  id?: string
  symbol?: string
  name?: string
  chainId?: string | null
  decimals?: number
  address?: string | null
  totalSupply?: string | null
  tags?: string[]
  canonicalId?: string | null
}

function formatToken(t: TokenLike): string[] {
  const lines: string[] = [`### ${t.symbol ?? '?'} \`${t.id ?? '?'}\``]
  if (t.name && t.name !== t.symbol) lines.push(`- **Name**: ${t.name}`)
  lines.push(`- **Chain**: ${t.chainId ?? '_(canonical, chainless)_'}`)
  if (t.address) lines.push(`- **Address**: \`${t.address}\``)
  if (typeof t.decimals === 'number') lines.push(`- **Decimals**: ${t.decimals}`)
  if (t.totalSupply) lines.push(`- **Total supply**: ${t.totalSupply}`)
  if (t.canonicalId) lines.push(`- **Canonical**: \`${t.canonicalId}\``)
  if (t.tags && t.tags.length > 0) lines.push(`- **Tags**: ${t.tags.join(', ')}`)
  lines.push('')
  return lines
}

function formatResponse(tokens: TokenLike[], total: number): string {
  if (tokens.length === 0) {
    return 'No tokens match the given filters.'
  }
  const lines: string[] = [
    '## Tokens',
    '',
    `Showing **${tokens.length}** of **${total}** matching tokens.`,
    '',
  ]
  for (const t of tokens) lines.push(...formatToken(t))
  lines.push('---')
  lines.push('*Use `get_token` with the `id` to fetch a single token.*')
  return lines.join('\n')
}

export async function executeGetTokens(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args ?? {})
    const luzia = getLuziaClientForKey(getCurrentApiKey())

    log.debug({ input }, 'Fetching tokens')

    const result = await luzia.tokens.list({
      search: input.search,
      chainId: input.chain,
      hasChain: input.hasChain === undefined ? undefined : input.hasChain === 'true',
      limit: input.limit,
    })

    return {
      content: [{ type: 'text', text: formatResponse(result.data, result.pagination?.total ?? 0) }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_tokens')
    return handleToolError(error, 'get_tokens')
  }
}
