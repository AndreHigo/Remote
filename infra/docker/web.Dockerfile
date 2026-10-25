FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY apps/desktop-control/package.json apps/desktop-control/package.json
COPY apps/web/package.json apps/web/package.json
COPY services/api/package.json services/api/package.json
COPY services/realtime/package.json services/realtime/package.json
RUN npm ci

COPY . .
ARG VITE_API_URL=/api
ARG VITE_REALTIME_URL=/realtime
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REALTIME_URL=$VITE_REALTIME_URL
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
