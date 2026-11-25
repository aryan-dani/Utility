# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# server/package.json pins node-domexception to file:../scripts/domexception-shim.
# npm resolves that to /scripts/domexception-shim, so the shim must exist there before install.
COPY scripts/domexception-shim /scripts/domexception-shim
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev=false

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
COPY scripts/domexception-shim /scripts/domexception-shim
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/package.json server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc -p tsconfig.json

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Kolkata
RUN useradd --system --uid 10001 --create-home utility
# node_modules links the shim by absolute path (/scripts/...), so copy it into the runtime image too.
COPY scripts/domexception-shim /scripts/domexception-shim
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server/package.json ./
COPY server/src/db/migrations ./dist/db/migrations
USER utility
# Default command overridden per service in compose
CMD ["node", "dist/api/index.js"]
