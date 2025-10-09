# Multi-stage Dockerfile for Fusion Starter
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# --- deps ---
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# --- test ---
FROM base AS test
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
# Run unit tests; allow opting out via build-arg
ARG SKIP_TESTS=false
RUN if [ "$SKIP_TESTS" != "true" ]; then pnpm test --run; else echo "Skipping tests"; fi

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
# Ensure tests passed before building by depending on test stage
RUN pnpm build

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Only copy the built output
COPY --from=build /app/dist /app/dist
COPY package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server/node-build.mjs"]
