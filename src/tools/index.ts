/**
 * MCP Tools Index
 *
 * Exports all tool definitions and handlers.
 */

export { executeGetExchanges, getExchangesTool } from './get-exchanges.js'
export { executeGetFiatCurrencies, getFiatCurrenciesTool } from './get-fiat-currencies.js'
export { executeGetHistory, getHistoryTool } from './get-history.js'
export { executeGetMarkets, getMarketsTool } from './get-markets.js'
export { executeGetTicker, getTickerTool } from './get-ticker.js'
export { executeGetTickers, getTickersTool } from './get-tickers.js'
export { executeGetToken, getTokenTool } from './get-token.js'
export { executeGetTokens, getTokensTool } from './get-tokens.js'

/**
 * All available tools
 */
export const tools = [
  { name: 'get_ticker', module: 'get-ticker' },
  { name: 'get_tickers', module: 'get-tickers' },
  { name: 'get_history', module: 'get-history' },
  { name: 'get_exchanges', module: 'get-exchanges' },
  { name: 'get_markets', module: 'get-markets' },
  { name: 'get_tokens', module: 'get-tokens' },
  { name: 'get_token', module: 'get-token' },
  { name: 'get_fiat_currencies', module: 'get-fiat-currencies' },
] as const

export type ToolName = (typeof tools)[number]['name']
