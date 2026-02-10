/**
 * MCP Prompts Index
 *
 * Exports all prompt definitions and generators.
 */

export { analyzePricePrompt, generateAnalyzePricePrompt } from './analyze-price.js'
export { compareExchangesPrompt, generateCompareExchangesPrompt } from './compare-exchanges.js'

/**
 * All available prompts
 */
export const prompts = [
  { name: 'analyze_price_movement', module: 'analyze-price' },
  { name: 'compare_exchanges', module: 'compare-exchanges' },
] as const

export type PromptName = (typeof prompts)[number]['name']
