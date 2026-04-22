# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# EXPO_PUBLIC_* vars are baked at build time — pass via --build-arg
ARG EXPO_PUBLIC_API_URL=/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Expo SDK 55 — exports static web build to /app/dist
RUN npx expo export --platform web

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# curl needed for the Docker health check
RUN apk add --no-cache curl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
