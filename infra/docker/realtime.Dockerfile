FROM node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY apps/desktop-control/package.json apps/desktop-control/package.json
COPY apps/web/package.json apps/web/package.json
COPY services/api/package.json services/api/package.json
COPY services/realtime/package.json services/realtime/package.json
RUN npm ci

COPY . .
RUN npm run build -w services/realtime

FROM build AS production-deps
RUN npm prune --omit=dev

FROM node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/services/realtime/package.json ./services/realtime/package.json
COPY --from=production-deps /app/services/realtime/dist ./services/realtime/dist

USER node
EXPOSE 4200
CMD ["node", "services/realtime/dist/server.js"]
