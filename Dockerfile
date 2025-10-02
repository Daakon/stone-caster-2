# syntax=docker/dockerfile:1

############################
# Build stage
############################
FROM node:20-alpine AS build
WORKDIR /app

# Root lockfile
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Build only what we need for the API
COPY backend ./backend
COPY shared ./shared

# Emit to ./dist (matches your root package.json "build:server" script)
RUN npm run build:server

############################
# Runtime stage
############################
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Prod deps only
COPY package.json package-lock.json ./
# Install production deps without running lifecycle scripts (avoid husky prepare)
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# Bring in the built server
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
