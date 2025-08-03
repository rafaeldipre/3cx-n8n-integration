# 3CX n8n Integration - Production Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the project
RUN npm run build:prod

# Remove dev dependencies and clean up
RUN npm prune --production && \
    rm -rf src/ tests/ docs/ templates/ && \
    rm -rf node_modules/@types/ && \
    rm -rf .git/ .github/ && \
    npm cache clean --force

# Production stage
FROM n8nio/n8n:latest

# Metadata
LABEL maintainer="3CX n8n Integration Team <support@your-company.com>"
LABEL version="2.0.0"
LABEL description="n8n with 3CX Call Control integration"
LABEL org.opencontainers.image.title="n8n-3cx-integration"
LABEL org.opencontainers.image.description="Enterprise-grade n8n integration for 3CX Phone Systems"
LABEL org.opencontainers.image.vendor="Your Company"
LABEL org.opencontainers.image.source="https://github.com/your-org/3cx-n8n-integration"
LABEL org.opencontainers.image.documentation="https://github.com/your-org/3cx-n8n-integration/blob/main/README.md"

# Switch to root for installation
USER root

# Install additional system dependencies if needed
RUN apk add --no-cache \
    curl \
    jq \
    && rm -rf /var/cache/apk/*

# Create directory for custom nodes
RUN mkdir -p /home/node/.n8n/nodes/3cx-integration && \
    chown -R node:node /home/node/.n8n/

# Switch back to node user
USER node

# Set working directory
WORKDIR /home/node/.n8n/nodes/3cx-integration

# Copy built application from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist/
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules/
COPY --from=builder --chown=node:node /app/README.md ./
COPY --from=builder --chown=node:node /app/LICENSE ./

# Set environment variables for n8n
ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/nodes"
ENV N8N_DEFAULT_LOCALE="en"
ENV N8N_METRICS="true"
ENV N8N_LOG_LEVEL="info"
ENV N8N_LOG_OUTPUT="console"

# 3CX specific environment variables
ENV N8N_3CX_LOG_LEVEL="info"
ENV N8N_3CX_TIMEOUT="30000"
ENV N8N_3CX_RETRY_ATTEMPTS="3"
ENV N8N_3CX_MAX_CONCURRENT_CALLS="10"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5678/healthz || exit 1

# Add health check script
COPY --chown=node:node docker/healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/healthcheck.sh

# Expose n8n port
EXPOSE 5678

# Start n8n with custom configuration
CMD ["n8n", "start"]