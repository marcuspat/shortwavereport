# Multi-stage build for Node.js application
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for audio processing
RUN apk add --no-cache \
    ffmpeg \
    sox \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
EXPOSE 3000 8080
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for production
RUN apk add --no-cache \
    ffmpeg \
    sox \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S shortwavereport -u 1001

WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=shortwavereport:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=shortwavereport:nodejs /app/src ./src
COPY --from=build --chown=shortwavereport:nodejs /app/package*.json ./
COPY --from=build --chown=shortwavereport:nodejs /app/demo.js ./

# Create data directories with proper permissions
RUN mkdir -p data/memory data/audio data/analysis data/reports && \
    chown -R shortwavereport:nodejs data/

# Switch to non-root user
USER shortwavereport

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose ports
EXPOSE 3000 8080

# Default command
CMD ["npm", "start"]