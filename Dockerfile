# Build stage
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

# Install dependencies (using --ignore-scripts to skip platform-specific postinstall)
RUN bun install --frozen-lockfile --ignore-scripts

# Copy MCP source (no internal workspace dependencies needed)
COPY apps/mcp ./apps/mcp

# Build the MCP server
WORKDIR /app/apps/mcp
RUN bun run build

# Production stage
FROM oven/bun:1.3.10-slim AS runner

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 luzia && \
    useradd --system --uid 1001 --gid 1001 --no-create-home luzia

# Copy built output and dependencies
COPY --from=builder /app/apps/mcp/dist ./dist
COPY --from=builder /app/apps/mcp/package.json ./
COPY --from=builder /app/node_modules ./node_modules

USER luzia

EXPOSE 50080

ENV NODE_ENV=production
ENV MCP_PORT=50080

# Start the server in HTTP (remote) mode
CMD ["bun", "run", "start"]
