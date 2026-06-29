# Stage 1 — install and build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2 — production image
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

# Only copy production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

# Apply schema directly then start the server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
