/**
 * get_balance Tool
 *
 * Get the current user's balance and lifetime spending summary.
 */

import { createLogger } from '../logging.js'
import { getLuziaClient } from '../sdk.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-balance' })

/**
 * Tool definition for MCP
 */
export const getBalanceTool = {
  name: 'get_balance',
  description:
    'Get your current Luzia account balance, lifetime spending, and a link to top up. Use this to check how much credit you have remaining before making requests.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
}

/**
 * Execute the get_balance tool
 */
export async function executeGetBalance(): Promise<ToolResult> {
  try {
    log.debug({}, 'Fetching balance')

    const luzia = getLuziaClient()
    const balance = await luzia.billing.getBalance()

    const response = formatBalanceResponse(balance)

    log.debug({ balance_cents: balance.balance_cents }, 'Balance fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_balance')
    return handleToolError(error, 'get_balance')
  }
}

/**
 * Format balance data for AI-friendly response
 */
function formatBalanceResponse(balance: {
  balance_usd: string
  balance_cents: number
  lifetime_spent_usd: string
  lifetime_spent_cents: number
  free_credit_usd: string
  top_up_url: string
}): string {
  const isLow = balance.balance_cents < 100
  const isDepleted = balance.balance_cents <= 0
  const statusIcon = isDepleted ? '🔴' : isLow ? '🟠' : '🟢'

  const lines: string[] = [
    '## Account Balance',
    '',
    `${statusIcon} **Current Balance:** $${balance.balance_usd}`,
    `- **Lifetime Spent:** $${balance.lifetime_spent_usd}`,
    `- **Free Credit:** $${balance.free_credit_usd}`,
    '',
  ]

  if (isDepleted) {
    lines.push('⚠️ **Your balance is depleted.** API requests will return 402 errors.')
    lines.push(`Top up your balance at: ${balance.top_up_url}`)
  } else if (isLow) {
    lines.push('⚠️ **Your balance is low.** Consider topping up to avoid service interruption.')
    lines.push(`Top up your balance at: ${balance.top_up_url}`)
  }

  return lines.join('\n')
}
