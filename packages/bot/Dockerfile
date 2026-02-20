FROM node:18-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./
COPY packages/bot/package.json ./packages/bot/
COPY packages/templates/package.json ./packages/templates/

# Install all dependencies
RUN npm ci --ignore-scripts

# Copy source
COPY packages/bot/ ./packages/bot/
COPY packages/templates/ ./packages/templates/

# Build bot
RUN npx tsc -p packages/bot/tsconfig.json

# --- Production stage ---
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/bot/package.json ./packages/bot/
COPY packages/templates/ ./packages/templates/

RUN npm ci --omit=dev --ignore-scripts

# Copy built files
COPY --from=builder /app/packages/bot/dist ./packages/bot/dist

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "packages/bot/dist/index.js"]
