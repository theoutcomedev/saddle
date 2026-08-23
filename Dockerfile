FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git
RUN npm install -g pnpm

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:22-alpine

WORKDIR /app
RUN npm install -g pnpm pm2 tsx

COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 3080

CMD ["pm2-runtime", "--node-args=--expose-internals", "apps/cli/src/bin.ts", "--interpreter", "tsx", "--", "web", "--port", "3080", "--host", "0.0.0.0"]
