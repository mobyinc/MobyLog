# Use Alpine variant for better Docker compatibility
FROM node:18-alpine

# Set environment variables to handle threading issues
ENV PORT=80
ENV UV_THREADPOOL_SIZE=4
ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./

# Use safer npm install flags to avoid threading issues
RUN npm ci --no-audit --no-fund

# Install PM2 globally
RUN npm install pm2 -g

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Clean up dev dependencies after build
RUN npm ci --only=production --no-audit --no-fund

# Expose port
EXPOSE 80

CMD ["pm2-runtime", "ecosystem.config.js"]
