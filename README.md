# @luziadev/mcp-server

[![npm version](https://img.shields.io/npm/v/@luziadev/mcp-server.svg)](https://www.npmjs.com/package/@luziadev/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server for cryptocurrency pricing data. Allows AI assistants like Claude to access real-time ticker prices, exchange information, and market data from the [Luzia API](https://luzia.dev).

## Features

- Real-time ticker prices from multiple exchanges (Binance, Coinbase, Kraken, OKX, Bybit)
- Market information and trading pairs
- Exchange status and availability

## Requirements

- [Bun](https://bun.sh) runtime
- A Luzia API key ([get one here](https://luzia.dev/keys))

**Install Bun:**

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

## Claude Desktop Setup

1. **Find your Bun path:**

   ```bash
   which bun
   # Usually: /Users/YOUR_USERNAME/.bun/bin/bun
   ```

2. **Open Claude Desktop config:**

   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

3. **Add the Luzia server** (replace `YOUR_USERNAME` and your API key):

   ```json
   {
     "mcpServers": {
       "luzia": {
         "command": "/Users/YOUR_USERNAME/.bun/bin/bun",
         "args": ["x", "@luziadev/mcp-server", "--stdio"],
         "env": {
           "PATH": "/Users/YOUR_USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin",
           "LUZIA_API_KEY": "lz_your_api_key"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop** (Cmd+Q on macOS, then reopen)

5. **Start asking questions:**
   - "What's the current price of Bitcoin on Binance?"
   - "Compare ETH prices across all exchanges"
   - "Show me the top trading pairs on Coinbase"

## Claude Code Setup

Add to `.claude/settings.json` (replace `YOUR_USERNAME`):

```json
{
  "mcpServers": {
    "luzia": {
      "command": "/Users/YOUR_USERNAME/.bun/bin/bun",
      "args": ["x", "@luziadev/mcp-server", "--stdio"],
      "env": {
        "PATH": "/Users/YOUR_USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin",
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
| `get_exchanges` | List supported exchanges and their status |
| `get_markets` | List available trading pairs on an exchange |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `analyze_price_movement` | Analyze price movements and trends for a trading pair |
| `compare_exchanges` | Compare prices across exchanges for arbitrage opportunities |

## Rate Limits

Inherits from your Luzia subscription tier:
- **Free:** 100 requests/minute, 5,000/day
- **Pro:** 1,000 requests/minute, 20,000/day

## Troubleshooting

### Claude Desktop can't find the server

1. Verify `claude_desktop_config.json` is valid JSON
2. Ensure the bun path is correct (run `which bun`)
3. Restart Claude Desktop completely (Cmd+Q on macOS)

### "Unauthorized" errors

1. Verify your API key is correct
2. Check that the API key has not expired

## License

MIT - see [LICENSE](./LICENSE) for details.
