FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY src/ ./src/
COPY data/ ./data/

# Create db directory
RUN mkdir -p db

# Import data
RUN node src/import.js

# Expose port for SSE (if used)
EXPOSE 3000

# Run MCP server
CMD ["node", "src/index.js"]
