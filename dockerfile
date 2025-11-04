# Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build:prod

# Production
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy package files
COPY package*.json ./
COPY --chown=nextjs:nodejs --from=build /app/.next ./.next
COPY --chown=nextjs:nodejs --from=build /app/public ./public
COPY --chown=nextjs:nodejs --from=build /app/node_modules ./node_modules

USER nextjs

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
