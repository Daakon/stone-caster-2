# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app/backend

# Install only backend deps (supports npm/yarn/pnpm)
COPY backend/package.json ./
COPY backend/package-lock.json* ./
COPY backend/pnpm-lock.yaml* ./
COPY backend/yarn.lock* ./

RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@latest --activate && pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
      corepack enable && corepack prepare yarn@stable --activate && yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# ---- build ----
FROM node:20-alpine AS build
ARG FORCE_REBUILD=0
WORKDIR /app

COPY --from=deps /app/backend /app/backend

COPY backend /app/backend
COPY shared /app/shared
COPY tsconfig.paths.json /app/tsconfig.paths.json

WORKDIR /app/backend

# Cache-busting no-op to force rebuilds when needed
RUN echo "force-rebuild=${FORCE_REBUILD}" > /dev/null

# Try common build commands; fallback to tsc if available
RUN if npm run | grep -q "build"; then npm run build; \
    elif [ -f tsconfig.json ]; then npx tsc -p tsconfig.json; \
    else echo "No build step needed"; fi

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/package.json ./package.json

EXPOSE 8080

CMD ["node", "dist/index.js"]
