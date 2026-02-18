/**
 * Luzia API Client
 *
 * HTTP client for forwarding MCP tool calls to the Luzia API.
 * This module provides a thin proxy layer that handles:
 * - API key authentication
 * - Request formatting
 * - Error handling
 * - Response parsing
 */

import { env } from './config.js'
import { createLogger } from './logging.js'

const log = createLogger({ module: 'api-client' })

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Ticker data from the Luzia API
 */
export interface Ticker {
  symbol: string
  exchange: string
  last: number | null
  bid: number | null
  ask: number | null
  high: number | null
  low: number | null
  open: number | null
  volume: number | null
  quoteVolume: number | null
  change: number | null
  changePercent: number | null
  timestamp: string
}

/**
 * Exchange data from the Luzia API
 */
export interface Exchange {
  id: string
  name: string
  status: string
  websiteUrl: string | null
}

/**
 * Market data from the Luzia API
 */
export interface Market {
  symbol: string
  exchange: string
  base: string
  quote: string
  active: boolean
  precision?: {
    price: number
    amount: number
  }
  limits?: {
    price?: { min: number; max: number }
    amount?: { min: number; max: number }
  }
}

/**
 * A single OHLCV candlestick
 */
export interface OhlcvCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number | null
  trades: number | null
}

/**
 * Response containing OHLCV candlestick data
 */
export interface OhlcvResponse {
  exchange: string
  symbol: string
  interval: string
  candles: OhlcvCandle[]
  count: number
  start: number
  end: number
}

/**
 * API error with status code and message
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /**
   * Check if error is a "not found" error
   */
  isNotFound(): boolean {
    return this.status === 404
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }

  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(): boolean {
    return this.status === 429
  }

  /**
   * Check if error is a service unavailable error
   */
  isUnavailable(): boolean {
    return this.status === 503
  }
}

// ─────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────

/**
 * Luzia API Client
 */
class LuziaApiClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  /**
   * Make an authenticated request to the Luzia API
   */
  private async request<T>(
    path: string,
    options: { auth?: boolean; query?: Record<string, string | number | undefined> } = {}
  ): Promise<T> {
    const { auth = true, query } = options

    // Build URL with query parameters
    let url = `${this.baseUrl}${path}`
    if (query) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          params.set(key, String(value))
        }
      }
      const queryString = params.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (auth) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    log.debug({ url, auth }, 'Making API request')

    const response = await fetch(url, { headers })

    // Handle errors
    if (!response.ok) {
      let errorMessage = response.statusText
      let errorDetails: string | undefined

      try {
        const errorBody = (await response.json()) as { error?: string; message?: string }
        errorMessage = errorBody.error || errorMessage
        errorDetails = errorBody.message
      } catch {
        // Ignore JSON parse errors for error response
      }

      log.warn({ url, status: response.status, error: errorMessage }, 'API request failed')
      throw new ApiError(response.status, errorMessage, errorDetails)
    }

    return response.json() as Promise<T>
  }

  /**
   * Convert symbol from normalized format (BTC/USDT) to URL format (BTC-USDT)
   */
  private symbolToUrl(symbol: string): string {
    return symbol.replace('/', '-')
  }

  // ─────────────────────────────────────────────────────────────
  // Ticker Endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a single ticker
   * @param exchange Exchange ID (e.g., "binance")
   * @param symbol Normalized symbol (e.g., "BTC/USDT")
   */
  async getTicker(exchange: string, symbol: string): Promise<Ticker | null> {
    try {
      const urlSymbol = this.symbolToUrl(symbol)
      return await this.request<Ticker>(`/v1/ticker/${exchange.toLowerCase()}/${urlSymbol}`)
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound()) {
        return null
      }
      throw error
    }
  }

  /**
   * Get all tickers for an exchange
   * @param exchange Exchange ID (e.g., "binance")
   * @param options Pagination options
   */
  async getTickers(
    exchange: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ tickers: Ticker[]; total: number }> {
    return this.request<{ tickers: Ticker[]; total: number; limit: number; offset: number }>(
      `/v1/tickers/${exchange.toLowerCase()}`,
      { query: options }
    )
  }

  /**
   * Get tickers with filters (bulk endpoint)
   * @param options Filter and pagination options
   */
  async getTickersFiltered(options?: {
    exchange?: string
    symbols?: string[]
    limit?: number
    offset?: number
  }): Promise<{ tickers: Ticker[]; total: number }> {
    const query: Record<string, string | number | undefined> = {
      limit: options?.limit,
      offset: options?.offset,
    }

    if (options?.exchange) {
      query.exchange = options.exchange.toLowerCase()
    }

    if (options?.symbols && options.symbols.length > 0) {
      // Convert symbols to URL format and join with commas
      query.symbols = options.symbols.map((s) => this.symbolToUrl(s.toUpperCase())).join(',')
    }

    return this.request<{ tickers: Ticker[]; total: number; limit: number; offset: number }>(
      '/v1/tickers',
      { query }
    )
  }

  // ─────────────────────────────────────────────────────────────
  // History Endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Get historical OHLCV candle data
   * @param exchange Exchange ID (e.g., "binance")
   * @param symbol Normalized symbol (e.g., "BTC/USDT")
   * @param options Query options (interval, start, end, limit)
   */
  async getHistory(
    exchange: string,
    symbol: string,
    options?: {
      interval?: string
      start?: number
      end?: number
      limit?: number
    }
  ): Promise<OhlcvResponse> {
    const urlSymbol = this.symbolToUrl(symbol)
    return this.request<OhlcvResponse>(`/v1/history/${exchange.toLowerCase()}/${urlSymbol}`, {
      query: {
        interval: options?.interval,
        start: options?.start,
        end: options?.end,
        limit: options?.limit,
      },
    })
  }

  // ─────────────────────────────────────────────────────────────
  // Exchange Endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all enabled exchanges
   * Note: This endpoint does not require authentication
   */
  async getExchanges(): Promise<Exchange[]> {
    const response = await this.request<{ exchanges: Exchange[] }>('/v1/exchanges', { auth: false })
    return response.exchanges
  }

  // ─────────────────────────────────────────────────────────────
  // Market Endpoints
  // ─────────────────────────────────────────────────────────────

  /**
   * Get markets for an exchange
   * @param exchange Exchange ID (e.g., "binance")
   * @param options Filter and pagination options
   */
  async getMarkets(
    exchange: string,
    options?: {
      base?: string
      quote?: string
      active?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ markets: Market[]; total: number }> {
    const query: Record<string, string | number | undefined> = {
      limit: options?.limit,
      offset: options?.offset,
    }

    if (options?.base) {
      query.base = options.base.toUpperCase()
    }
    if (options?.quote) {
      query.quote = options.quote.toUpperCase()
    }
    if (options?.active !== undefined) {
      query.active = options.active ? 'true' : 'false'
    }

    return this.request<{ markets: Market[]; total: number; limit: number; offset: number }>(
      `/v1/markets/${exchange.toLowerCase()}`,
      { query }
    )
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let apiClientInstance: LuziaApiClient | null = null

/**
 * Get the API client singleton
 */
export function getApiClient(): LuziaApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new LuziaApiClient(env.api.url, env.api.key)
    log.info({ baseUrl: env.api.url }, 'API client initialized')
  }
  return apiClientInstance
}

/**
 * Reset the API client singleton (for testing)
 */
export function resetApiClient(): void {
  apiClientInstance = null
}
