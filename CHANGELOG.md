# Changelog

All notable changes to `@luziadev/mcp-server` will be documented in this file.

## [1.1.1] - 2026-02-18

### Fixed

- Release workflow updated for standalone repo (removed monorepo paths, fixed tag version extraction, dropped `--frozen-lockfile`)
- Removed stale `repository.directory` from `package.json`
- Removed unsupported `4h` candle interval from `get_history` tool and `analyze_ohlcv` prompt
- Changed ticker `timestamp` type from `number` to `string` for consistency with API responses

### Added

- Installation and updating instructions in README

## [1.1.0] - 2025-02-17

### Added

- **`get_history` tool** - Fetch historical OHLCV (Open, High, Low, Close, Volume) candlestick data for any trading pair. Supports configurable intervals (`1m`, `5m`, `15m`, `1h`, `1d`), custom time ranges, and up to 500 candles per request. Returns AI-friendly formatted summaries with period change, highs/lows, and volume totals.
- **`analyze_ohlcv` prompt** - Technical analysis prompt that fetches OHLCV data and asks the AI to perform trend analysis, identify support/resistance levels, analyze volume patterns, detect candlestick patterns, and assess momentum.
- **`OhlcvCandle` and `OhlcvResponse` types** in the API client for typed history data.
- **`getHistory` method** on the API client to call the `/v1/history/:exchange/:symbol` endpoint.

## [1.0.0] - 2025-01-20

### Added

- Initial release of the Luzia MCP server.
- **Transports:** HTTP/SSE (Streamable HTTP) and stdio (Claude Desktop).
- **Authentication:** API key required for HTTP transport with rate limiting per tier.
- **`get_ticker` tool** - Get real-time price data for a single trading pair.
- **`get_tickers` tool** - Get all ticker prices for an exchange.
- **`get_exchanges` tool** - List all supported exchanges.
- **`get_markets` tool** - List available markets for an exchange.
- **`analyze_price_movement` prompt** - Analyze price data for a trading pair with contextual market insights.
- **`compare_exchanges` prompt** - Compare prices for a symbol across multiple exchanges.
- **API client** with error handling, retry logic, and symbol normalization.
- **Structured logging** via Pino with configurable log levels.
