# @luziadev/mcp-server

[![npm version](https://img.shields.io/npm/v/@luziadev/mcp-server.svg)](https://www.npmjs.com/package/@luziadev/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server for cryptocurrency pricing data. Gives AI assistants like Claude real-time access to ticker prices, exchange information, and OHLCV history from the [Luzia API](https://luzia.dev).

## Features

- Real-time ticker prices from multiple exchanges (Binance, Coinbase, Kraken, OKX, Bybit)
- Historical OHLCV candlestick data for technical analysis
- Market information and trading pairs
- Exchange status and availability

## Requirements

- A Luzia API key ([get one here](https://luzia.dev/keys))

## Remote connection (recommended)

The fastest way to use Luzia with your AI assistant is to connect to our hosted MCP server at `https://mcp.luzia.dev/mcp`. No install required. Just paste the URL and your API key.

### Claude.ai web / Anthropic console

Settings → Integrations → **Add custom MCP**:
- **URL:** `https://mcp.luzia.dev/mcp`
- **Authentication:** Bearer token — paste your API key (`lz_...`)

### Claude Desktop (via `mcp-remote`)

Claude Desktop's native remote MCP support is still rolling out, so the easiest path today is the `mcp-remote` shim, which bridges a remote HTTP MCP to Claude Desktop's stdio interface.

Edit your config:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "luzia": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.luzia.dev/mcp",
        "--header",
        "Authorization:Bearer lz_your_api_key"
      ]
    }
  }
}
```

Restart Claude Desktop (Cmd+Q on macOS) and start asking questions.

### VS Code, Cursor, Cline, Continue.dev

Paste the URL and Authorization header into the MCP settings for your tool:

- **URL:** `https://mcp.luzia.dev/mcp`
- **Header:** `Authorization: Bearer lz_your_api_key`

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Then point the inspector at `https://mcp.luzia.dev/mcp` and add the `Authorization: Bearer lz_...` header.

## Local install (advanced)

Prefer running the server locally? `@luziadev/mcp-server` still ships on npm and runs over stdio.

```bash
# Run directly with npx (no install needed)
LUZIA_API_KEY=lz_your_api_key npx -y @luziadev/mcp-server --stdio
```

### Claude Desktop config (local stdio)

```json
{
  "mcpServers": {
    "luzia": {
      "command": "npx",
      "args": ["-y", "@luziadev/mcp-server", "--stdio"],
      "env": {
        "LUZIA_API_KEY": "lz_your_api_key"
      }
    }
  }
}
```

### Claude Code config (local stdio)

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "luzia": {
      "command": "npx",
      "args": ["-y", "@luziadev/mcp-server", "--stdio"],
      "env": {
        "LUZIA_API_KEY": "lz_your_api_key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_ticker` | Get current price for a specific trading pair |
| `get_tickers` | Get prices for multiple pairs or all pairs on an exchange |
| `get_history` | Get historical OHLCV candlestick data for a trading pair |
| `get_exchanges` | List supported exchanges and their status |
| `get_markets` | List available trading pairs on an exchange |

## Available Prompts

Prompts are pre-built analysis templates that fetch data and generate structured insights. They are available in clients that support MCP prompts (e.g., Claude Desktop via the `/` menu).

> **Note:** Claude Code does not support MCP prompts directly — use natural language instead (e.g., "Analyze BTC/USDT price movement on Binance") and it will call the underlying tools automatically.

| Prompt | Description |
|--------|-------------|
| `analyze_price_movement` | Analyze price movements and trends for a trading pair |
| `analyze_ohlcv` | Analyze OHLCV candlestick data with technical analysis |
| `compare_exchanges` | Compare prices across exchanges for arbitrage opportunities |

### Prompt Examples

#### `analyze_price_movement`

Fetches current ticker data and analyzes bid-ask spread, 24h stats, and volume.

**Arguments:**
- `exchange` (required): e.g., `"binance"`, `"coinbase"`
- `symbol` (required): e.g., `"BTC/USDT"`, `"ETH/USD"`

**Claude Desktop:** Type `/` → select `analyze_price_movement` → fill in `exchange: binance`, `symbol: BTC/USDT`

**Natural language (any client):** "Analyze the current BTC/USDT price movement on Binance"

#### `analyze_ohlcv`

Fetches historical candlestick data and requests technical analysis including trends, support/resistance, volume patterns, and candlestick patterns.

**Arguments:**
- `exchange` (required): e.g., `"binance"`
- `symbol` (required): e.g., `"BTC/USDT"`
- `interval` (optional): `"1m"`, `"5m"`, `"15m"`, `"1h"`, `"1d"` (default: `"1h"`)
- `period` (optional): e.g., `"24h"`, `"7d"`, `"30d"` (default: `"24h"`)

**Claude Desktop:** Type `/` → select `analyze_ohlcv` → fill in `exchange: binance`, `symbol: BTC/USDT`, `interval: 1h`

**Natural language (any client):** "Analyze BTC/USDT OHLCV candles on Binance with 1h interval for the last 7 days"

#### `compare_exchanges`

Fetches ticker data from multiple exchanges and compares prices, spreads, and liquidity for arbitrage analysis.

**Arguments:**
- `symbol` (required): e.g., `"BTC/USDT"`
- `exchanges` (optional): comma-separated list, e.g., `"binance,coinbase,kraken"` (default: `"binance,coinbase,kraken"`)

**Claude Desktop:** Type `/` → select `compare_exchanges` → fill in `symbol: BTC/USDT`

**Natural language (any client):** "Compare BTC/USDT prices across all exchanges"

## Rate Limits

Inherits from your Luzia subscription tier:
- **Free:** 100 requests/minute, 5,000/day
- **Pro:** 1,000 requests/minute, 20,000/day

## Troubleshooting

### "Unauthorized" errors

- **Remote:** verify your `Authorization: Bearer lz_...` header is set and the key starts with `lz_`.
- **Stdio:** verify `LUZIA_API_KEY` is set in your MCP client config and that the key has not been revoked.

### Remote session errors

- If your client reports "Unknown session id", the server was restarted or your session expired (30min idle). Reconnect and the client will re-initialize automatically.

### Claude Desktop can't find the server (stdio)

- Verify `claude_desktop_config.json` is valid JSON.
- Ensure Node.js 20+ is installed (`node --version`).
- Restart Claude Desktop completely (Cmd+Q on macOS).

## License

MIT - see [LICENSE](./LICENSE) for details.
