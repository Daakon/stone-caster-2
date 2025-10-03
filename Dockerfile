# syntax=docker/dockerfile:1

############################
# Build stage
############################
FROM node:20-alpine AS build
WORKDIR /app

# Copy all package files first
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install all dependencies (including workspace dependencies)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source code
COPY backend ./backend
COPY shared ./shared

# Install dependencies in each workspace to ensure they're available
RUN cd shared && npm install
RUN cd backend && npm install

# Build shared first, then backend
RUN npm run build --workspace=shared
RUN npm run build:server

############################
# Runtime stage
############################
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV SUPABASE_URL=http://localhost:54321
ENV SUPABASE_SERVICE_KEY=service-local
ENV SUPABASE_ANON_KEY=anon-local
ENV OPENAI_API_KEY=openai-local
ENV PRIMARY_AI_MODEL=gpt-4
ENV SESSION_SECRET=dev-session-secret

# Copy package.json files and install production dependencies
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# Bring in the built server, shared package, and node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/
COPY --from=build /app/backend/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/index.js"]
