FROM node:20-slim

# Install Chromium and required fonts/system dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libxss1 \
    libasound2 \
    libgbm1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Point Puppeteer to the installed Chromium binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=4000 \
    HOST=0.0.0.0 \
    NODE_ENV=production

WORKDIR /app

# Copy Precheckwebsite dependencies and install
COPY Precheckwebsite/package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY Precheckwebsite/ ./

EXPOSE 4000

CMD ["node", "server.js"]
