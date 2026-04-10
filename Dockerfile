# Stage 1: Build TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production image
FROM node:22-alpine

RUN addgroup -S mcp && adduser -S mcp -G mcp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ ./dist/

RUN chown -R mcp:mcp /home/mcp

USER mcp
ENV HOME=/home/mcp

EXPOSE 3000 3001

CMD ["node", "dist/index.js"]
