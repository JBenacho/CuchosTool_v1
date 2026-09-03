# Build reproducible (Backlog v6 BL-004) - artefacto inmutable
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc -p tsconfig.json

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3001/healthz || exit 1
CMD ["node", "dist/server.js"]
