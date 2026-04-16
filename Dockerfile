# Build stage (bun handles the monorepo workspace + frozen lockfile install)
FROM oven/bun:1.3.10 AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json bun.lock tsconfig.json ./

# Copy all workspace package.json files (required for frozen lockfile)
COPY apps/api/package.json ./apps/api/
COPY apps/fetcher/package.json ./apps/fetcher/
COPY apps/mcp/package.json ./apps/mcp/
COPY apps/portal/package.json ./apps/portal/
COPY apps/telegram/package.json ./apps/telegram/
COPY apps/waka/package.json ./apps/waka/
COPY apps/discord/package.json ./apps/discord/
COPY apps/xfetcher/package.json ./apps/xfetcher/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cache/package.json ./packages/cache/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/db/package.json ./packages/db/
COPY packages/errors/package.json ./packages/errors/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/metrics/package.json ./packages/metrics/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/xconnectors/package.json ./packages/xconnectors/

# Install dependencies (ignore-scripts to skip platform-specific postinstall)
RUN bun install --frozen-lockfile --ignore-scripts

# @luziadev/sdk is a bun workspace package (packages/sdk) — bun symlinks it
# into node_modules during install, so the source must be present and built
# before we can build the MCP server.
COPY packages/sdk ./packages/sdk
COPY apps/mcp ./apps/mcp

# Build the SDK first (tsc → packages/sdk/dist) so MCP can import from it.
WORKDIR /app/packages/sdk
RUN bun run build

# Build the MCP server (tsc emits to apps/mcp/dist)
WORKDIR /app/apps/mcp
RUN bun run build

# Production stage — Node 22 (the app runs on node, `bun run start` just shells out to node)
FROM node:22-slim AS runner

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 luzia && \
    useradd --system --uid 1001 --gid 1001 --no-create-home luzia

# Bun installs with an isolated layout: /app/node_modules holds the shared
# `.bun` store, and each workspace's own node_modules contains symlinks into
# it. We need both, plus the SDK (a workspace package that's symlinked as
# @luziadev/sdk) with its built dist.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/mcp/dist ./apps/mcp/dist
COPY --from=builder /app/apps/mcp/package.json ./apps/mcp/
COPY --from=builder /app/apps/mcp/node_modules ./apps/mcp/node_modules
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/

WORKDIR /app/apps/mcp

USER luzia

EXPOSE 50080

ENV NODE_ENV=production
ENV MCP_PORT=50080

# Run directly with node from apps/mcp — WORKDIR was set above
CMD ["node", "dist/index.js"]
