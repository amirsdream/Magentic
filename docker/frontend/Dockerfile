# Magentic Frontend (React/Vite) - Production Dockerfile
# Multi-stage build: build assets + nginx for serving

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine as builder

WORKDIR /build

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

# ============================================
# Stage 2: Production (nginx)
# ============================================
FROM nginx:alpine as production

# Labels
LABEL maintainer="Magentic Team"
LABEL description="Magentic Frontend UI"
LABEL version="1.0.0"

# Copy built assets
COPY --from=builder /build/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:80 || exit 1

# Default command
CMD ["nginx", "-g", "daemon off;"]
