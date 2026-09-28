FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY apps/web/package.json apps/web/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci

COPY . .
RUN npm run build -w services/api

FROM build AS production-deps
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/services/api/package.json ./services/api/package.json
COPY --from=production-deps /app/services/api/dist ./services/api/dist

USER node
EXPOSE 4100
CMD ["node", "services/api/dist/server.js"]
