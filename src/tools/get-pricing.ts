/**
 * get_pricing Tool
 *
 * Get the full pricing table for all Luzia API endpoints.
 */

import type { PricingResponse } from '@luziadev/sdk'
import { createLogger } from '../logging.js'
import { getLuziaClient } from '../sdk.js'
import { handleToolError, type ToolResult } from './error-handler.js'

const log = createLogger({ module: 'tool:get-pricing' })

/**
 * Tool definition for MCP
 */
export const getPricingTool = {
  name: 'get_pricing',
  description:
    'Get the full Luzia API pricing table. Shows the cost per request for each endpoint. Useful for understanding costs before making requests or estimating usage costs.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
}

/**
 * Execute the get_pricing tool
 */
export async function executeGetPricing(): Promise<ToolResult> {
  try {
    log.debug({}, 'Fetching pricing')

    const luzia = getLuziaClient()
    const pricing = await luzia.billing.getPricing()

    const response = formatPricingResponse(pricing)

    log.debug({}, 'Pricing fetched successfully')

    return {
      content: [{ type: 'text', text: response }],
    }
  } catch (error) {
    log.error({ error }, 'Failed to execute get_pricing')
    return handleToolError(error, 'get_pricing')
  }
}

/**
 * Format pricing data for AI-friendly response
 */
function formatPricingResponse(pricing: PricingResponse): string {
  const lines: string[] = [
    '## Luzia API Pricing',
    '',
    `**Currency:** ${pricing.currency}`,
    `**Free Credit:** $${pricing.free_credit_usd.toFixed(2)}`,
    '',
    '### REST API Endpoints',
    '',
    '| Endpoint | Cost | Unit |',
    '|----------|------|------|',
  ]

  for (const entry of pricing.rest) {
    if (entry.tiers) {
      // Tiered pricing (e.g., history endpoint)
      const tierStr = entry.tiers.map((t) => `${t.limit}: $${t.cost_usd}`).join(' | ')
      lines.push(`| ${entry.endpoint} | ${tierStr} | ${entry.unit} |`)
    } else {
      lines.push(`| ${entry.endpoint} | $${entry.cost_usd} | ${entry.unit} |`)
    }
  }

  lines.push('')
  lines.push('### WebSocket')
  lines.push('')
  lines.push('| Description | Cost | Unit |')
  lines.push('|-------------|------|------|')

  for (const entry of pricing.websocket) {
    lines.push(`| ${entry.description} | $${entry.cost_usd} | ${entry.unit} |`)
  }

  lines.push('')
  lines.push('### Free Endpoints')
  lines.push('')
  for (const endpoint of pricing.free_endpoints) {
    lines.push(`- ${endpoint}`)
  }

  lines.push('')
  lines.push('*All billing tools (get_balance, get_pricing) are free to use.*')

  return lines.join('\n')
}
