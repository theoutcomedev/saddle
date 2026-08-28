FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git
RUN npm install -g pnpm

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache bubblewrap bash docker-cli docker-cli-compose curl
RUN npm install -g pnpm pm2 tsx

COPY --from=builder /app /app
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["pm2-runtime", "--node-args=--expose-internals", "apps/cli/src/bin.ts", "--interpreter", "tsx", "--", "web", "--port", "3080", "--host", "0.0.0.0", "--trusted-host", "91.99.165.95"]
