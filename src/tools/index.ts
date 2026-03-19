/**
 * MCP Tools Index
 *
 * Exports all tool definitions and handlers.
 */

export { executeGetBalance, getBalanceTool } from './get-balance.js'
export { executeGetExchanges, getExchangesTool } from './get-exchanges.js'
export { executeGetHistory, getHistoryTool } from './get-history.js'
export { executeGetMarkets, getMarketsTool } from './get-markets.js'
export { executeGetPricing, getPricingTool } from './get-pricing.js'
export { executeGetTicker, getTickerTool } from './get-ticker.js'
export { executeGetTickers, getTickersTool } from './get-tickers.js'

/**
 * All available tools
 */
export const tools = [
  { name: 'get_ticker', module: 'get-ticker' },
  { name: 'get_tickers', module: 'get-tickers' },
  { name: 'get_history', module: 'get-history' },
  { name: 'get_exchanges', module: 'get-exchanges' },
  { name: 'get_markets', module: 'get-markets' },
  { name: 'get_balance', module: 'get-balance' },
  { name: 'get_pricing', module: 'get-pricing' },
] as const

export type ToolName = (typeof tools)[number]['name']
