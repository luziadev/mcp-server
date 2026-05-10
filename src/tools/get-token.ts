/**
 * get_token Tool
 *
 * Look up a single Luzia token by composite id.
 */

import { z } from 'zod'
import { getCurrentApiKey } from '../context.js'
import { createLogger } from '../logging.js'
import { getLuziaClientForKey } from '../sdk.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-token' })

export const getTokenTool = {
  name: 'get_token',
  description:
    'Get a single token by its composite id ("crypto:SYMBOL" for chainless canonical assets like "crypto:BTC", or "{chain}:SYMBOL" for on-chain instances like "ethereum:WETH"). Returns full metadata including decimals, address, tags, total supply, and canonical link.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'Composite token id, e.g. "crypto:USDC" or "ethereum:WETH".',
      },
    },
    required: ['id'],
  },
}

const inputSchema = z.object({
  id: z.string().min(1),
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
  logoUrl?: string | null
}

function formatToken(t: TokenLike): string {
  const lines: string[] = [`## ${t.symbol ?? '?'} \`${t.id ?? '?'}\``, '']
  if (t.name && t.name !== t.symbol) lines.push(`- **Name**: ${t.name}`)
  lines.push(`- **Chain**: ${t.chainId ?? '_(canonical, chainless)_'}`)
  if (t.address) lines.push(`- **Address**: \`${t.address}\``)
  if (typeof t.decimals === 'number') lines.push(`- **Decimals**: ${t.decimals}`)
  if (t.totalSupply) lines.push(`- **Total supply**: ${t.totalSupply}`)
  if (t.canonicalId) lines.push(`- **Canonical**: \`${t.canonicalId}\``)
  if (t.tags && t.tags.length > 0) lines.push(`- **Tags**: ${t.tags.join(', ')}`)
  if (t.logoUrl) lines.push(`- **Logo**: ${t.logoUrl}`)
  return lines.join('\n')
}

export async function executeGetToken(args: unknown): Promise<ToolResult> {
  try {
    const input = inputSchema.parse(args)
    const luzia = getLuziaClientForKey(getCurrentApiKey())

    log.debug({ id: input.id }, 'Fetching token')

    const token = await luzia.tokens.get(input.id)

    return {
      content: [{ type: 'text', text: formatToken(token) }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_token')
    return handleToolError(error, 'get_token')
  }
}
