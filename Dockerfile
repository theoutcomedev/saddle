FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy all package.json files for workspace setup
COPY patches/ patches/
COPY packages/ packages/
COPY apps/ apps/
COPY scripts/ scripts/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache git
RUN npm install -g pnpm pm2 tsx

COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 3080

CMD ["pm2-runtime", "apps/cli/src/bin.ts", "--interpreter", "tsx", "--", "start", "--port", "3080"]
