# Changelog

All notable changes to `@luziadev/mcp-server` will be documented in this file.

## [1.3.0] - 2026-04-17

### Added

- **Hosted remote MCP server** at `https://mcp.luzia.dev/mcp` - Users can now connect directly over Streamable HTTP without installing anything locally. Advertised via a new `installation.remote` block and a `registryType: "remote"` package entry in `server.json`.
- **Per-user Bearer authentication** - In HTTP mode each client presents its own Luzia API key via `Authorization: Bearer lz_...` on session init. The key is bound to the MCP session and reused for subsequent calls, replacing the previous single-key server model.
- **Request-scoped API key context** (`src/context.ts`) - `AsyncLocalStorage`-based `requestContext` carries the authenticated user's key from the transport layer down to tool, prompt, and resource handlers.
- **Abuse guard middleware** (`src/middleware/abuse-guard.ts`) - In-memory token bucket keyed by client IP that throttles unauthenticated requests (30 failures / 60s window, 5min block) to prevent key-guessing and session-init DoS.
- **CORS allowlist** - Configurable via the new `ALLOWED_ORIGINS` env var; defaults to `claude.ai`, `console.anthropic.com`, and `luzia.dev`, plus `localhost` in non-production.
- **Session lifecycle management** - Idle sessions (>30min inactive) are evicted every 5 minutes, capped at 10,000 concurrent sessions with a `503 service_unavailable` when full, and unknown session IDs return `404 session_not_found`.
- **Dockerfile** - Multi-stage Node.js 22 image for standalone deployment (Railway and similar platforms) with non-root `luzia` user and built-in `curl` for healthchecks.
- **`assertStdioConfig()`** - Fails fast at launch with a clear message when `LUZIA_API_KEY` is missing in stdio mode.
- **JSON `404` handler** - `/.well-known/*` probes from `mcp-remote` and other OAuth-aware clients now receive JSON `404`s instead of Hono's default plain-text response.
- **Expanded README** - New "Remote connection (recommended)" section covering Claude.ai web, Claude Desktop via `mcp-remote`, VS Code/Cursor/Cline/Continue.dev, and MCP Inspector, plus detailed examples for each prompt.

### Changed

- **Per-key SDK client cache** - `getLuziaClient()` (single shared singleton) replaced by `getLuziaClientForKey(apiKey)` with a bounded LRU cache (max 500 clients). All tools (`get_ticker`, `get_tickers`, `get_history`, `get_exchanges`, `get_markets`), prompts (`analyze_price_movement`, `analyze_ohlcv`, `compare_exchanges`), and resource handlers updated to resolve the client from the request context.
- **`LUZIA_API_KEY` is now optional** at startup - Required only in stdio mode; HTTP mode accepts the key per-request via the Authorization header.
- **Default HTTP port** changed from `50060` to `50080` (`MCP_PORT`, `.env.example`, `server.json`, `CONTRIBUTING.md`, Dockerfile).
- **Railway config** updated for the standalone repo layout (`dockerfilePath = "Dockerfile"`, `startCommand = "node dist/index.js"`, `internalPort = 50080`).
- **`dev` script** now uses `node --env-file=.env --watch dist/index.js` so local runs pick up `.env` automatically.
- **Health and info endpoints** report version `1.3.0`, the new "Streamable HTTP with Bearer auth" transport, and include `analyze_ohlcv` in the prompts list.
- **Bumped version to 1.3.0** across `package.json` and `server.json` (top-level and packages).

## [1.2.2] - 2026-04-07

### Added

- **`get_history` tool in `server.json`** - Added the `get_history` tool definition to the MCP server manifest, making it discoverable by MCP registries and clients.
- **`get_history` in HTTP health endpoint** - Listed `get_history` in the tools array returned by the health/info endpoint.

### Changed

- **Bumped version to 1.2.2** across `package.json`, `server.json` (top-level and packages).

## [1.2.0] - 2026-03-09

### Changed

- **Migrated to `@luziadev/sdk`** - Replaced the custom `api-client.ts` with the official `@luziadev/sdk` package for all API communication. Removed the custom API client, `ApiError` class, and all internal types (`Ticker`, `Exchange`, `Market`, `OhlcvCandle`, `OhlcvResponse`).
- **Switched runtime from Bun to Node.js** - The MCP server now runs on Node.js 20+ instead of Bun. Updated shebang (`#!/usr/bin/env node`), `engines` field, scripts (`node --watch`, `node dist/index.js`), and removed `build:bun` script.
- **Updated all documentation for Node.js** - README, CONTRIBUTING, and `server.json` now reference `npx`/`npm` instead of `bunx`/`bun`. Simplified Claude Desktop and Claude Code setup instructions (no more Bun path configuration needed).
- **Error handling updated to use `LuziaError`** - All tools and prompts now catch `LuziaError` from the SDK instead of the custom `ApiError` class. Error handler uses `error.code` checks (`not_found`, `rate_limit`, `unauthorized`, `server`) instead of status code methods.
- **OHLCV types updated** - Prompts now use `OHLCVCandle` from the SDK with nullable field handling (`?? 0`, `?? null`, `?? ''`).

## [1.1.1] - 2026-02-17

### Fixed

- Release workflow updated for standalone repo (removed monorepo paths, fixed tag version extraction, dropped `--frozen-lockfile`)
- Removed stale `repository.directory` from `package.json`

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
