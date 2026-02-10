# Contributing to @luziadev/mcp-server

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Claude Desktop │────▶│  stdio transport │
└─────────────────┘     └────────┬─────────┘
                                 │
┌─────────────────┐     ┌────────▼─────────┐     ┌─────────────┐
│   Web Client    │────▶│  HTTP/SSE        │────▶│  MCP Server │
└─────────────────┘     │  (Hono)          │     └──────┬──────┘
                        └──────────────────┘            │
                                                        ▼
                        ┌───────────────────────────────────────┐
                        │              Luzia API                │
                        │  (Authentication, Rate Limiting,      │
                        │   Ticker Data, Exchange Info)         │
                        └───────────────────────────────────────┘
```

The MCP server acts as a thin proxy to the Luzia API:
- No direct database access required
- Authentication handled by Luzia API
- Rate limits applied based on user tier
- Caching managed by the API layer

## Development

### Run from Source

```bash
# Clone the repository
git clone https://github.com/luziadev/luzia.git
cd luzia

# Install dependencies
bun install

# Run in development mode
bun dev:mcp

# Or run with stdio for testing
bun start:mcp:stdio
```

### Build for Production

```bash
cd apps/mcp

# Build with TypeScript
bun run build

# Output: dist/index.js
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `MCP_PORT` | HTTP server port | `50060` |
| `LOG_LEVEL` | Logging level (trace/debug/info/warn/error) | `info` |
| `LUZIA_API_URL` | Luzia API base URL | `http://localhost:3000` |
| `LUZIA_API_KEY` | Luzia API key (required) | - |

## Testing

### Health Check

```bash
curl http://localhost:50060/health
# {"status":"ok","timestamp":"..."}
```

### MCP Inspector

Use the official MCP Inspector for interactive testing:

```bash
npx @modelcontextprotocol/inspector bunx @luziadev/mcp-server --stdio
```

This opens a web UI where you can:
- List available tools and prompts
- Execute tools with custom arguments
- View responses in real-time

## HTTP/SSE Mode

For web-based AI applications, the MCP server supports HTTP transport.

### Running the Server

```bash
bunx @luziadev/mcp-server
```

The server runs on `http://localhost:50060` by default.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info and capabilities |
| `/health` | GET | Health check endpoint |
| `/mcp` | POST | MCP JSON-RPC endpoint |

## Publishing

The MCP server is published to npm via GitHub Actions when a version tag is pushed.

### Release Process

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "chore(mcp): prepare release X.Y.Z"
   ```

2. **Create and push a version tag**:
   ```bash
   git tag mcp-vX.Y.Z
   git push origin mcp-vX.Y.Z
   ```

   For example, to release version 0.9.0:
   ```bash
   git tag mcp-v0.9.0
   git push origin mcp-v0.9.0
   ```

3. **GitHub Actions will automatically**:
   - Build the package
   - Set the version from the tag
   - Publish to npm
   - Create a GitHub Release with release notes

### Requirements

- `NPM_TOKEN` secret must be configured in GitHub repository settings
- Tag must follow the format `mcp-v*` (e.g., `mcp-v0.9.0`, `mcp-v1.0.0`)

### Verify Publication

After the workflow completes:
- Check [npm package](https://www.npmjs.com/package/@luziadev/mcp-server)
- Check [GitHub Releases](https://github.com/luziadev/luzia/releases)
