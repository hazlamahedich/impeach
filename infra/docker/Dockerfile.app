# syntax=docker/dockerfile:1
#
# Shared Dockerfile for IIP app process stubs (Story 1.1 pattern).
# Each app is a simple `console.log("alive: <name>")` stub.
#
# Build args:
#   APP_NAME — the @iip/<name> workspace package to build (e.g. @iip/api)
#
# @rules STR-2 (6-process split)
# @adr ADR-021

FROM node:22-slim AS base
RUN npm install -g pnpm@9.15.4
WORKDIR /app

FROM base AS deps
COPY .npmrc pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/ingest-worker/package.json ./apps/ingest-worker/
COPY apps/serve-worker/package.json ./apps/serve-worker/
COPY apps/audit-worker/package.json ./apps/audit-worker/
COPY apps/enqueuer/package.json ./apps/enqueuer/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/render/package.json ./packages/render/
COPY packages/rag/package.json ./packages/rag/
COPY packages/graph/package.json ./packages/graph/
COPY packages/citation/package.json ./packages/citation/
COPY packages/auth/package.json ./packages/auth/
COPY packages/editorial/package.json ./packages/editorial/
COPY packages/eval/package.json ./packages/eval/
COPY packages/ingest/package.json ./packages/ingest/
COPY packages/llm/package.json ./packages/llm/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_NAME
COPY tsconfig.base.json tsconfig.json turbo.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN pnpm --filter ${APP_NAME} build

FROM base AS runtime
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production
# Validate APP_NAME resolves to a built app entrypoint before runtime.
RUN APP_DIR=$(echo "$APP_NAME" | cut -d/ -f2) && \
    test -n "$APP_DIR" && \
    test -f "apps/$APP_DIR/dist/index.js" || \
    { echo "Invalid APP_NAME '$APP_NAME': missing apps/$APP_DIR/dist/index.js"; exit 1; }
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/ ./packages/
COPY --from=build /app/apps/ ./apps/
COPY --from=deps /app/scripts/ ./scripts/
# Run the stub (proves it compiles + starts), then keep the container alive
# so Docker Compose healthcheck can verify liveness. Real servers replace this
# in later stories. Use `exec` for the tail so it becomes PID 1 and handles
# signals correctly.
CMD ["sh", "-c", "APP_DIR=$(echo $APP_NAME | cut -d/ -f2) && node apps/$APP_DIR/dist/index.js && exec tail -f /dev/null"]
