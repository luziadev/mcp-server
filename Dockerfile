# MCP server is a standalone npm package — no monorepo plumbing needed here.
# All deps (including @luziadev/sdk) are pulled from the public npm registry.

# Build stage — install deps + compile TS.
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund

COPY src ./src
RUN npx tsc && chmod +x dist/index.js

# Production stage — prod deps only, non-root user.
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 luzia \
    && useradd --system --uid 1001 --gid 1001 --no-create-home luzia

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist

USER luzia

EXPOSE 50080
ENV NODE_ENV=production
ENV MCP_PORT=50080

CMD ["node", "dist/index.js"]
