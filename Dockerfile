FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git
RUN npm install -g pnpm

# The workspace build type-checks every package, which exceeds Node's default
# heap limit on a small host; the type surface grows with each dependency bump
# (the pi-ai 0.85.1 release was the first to abort the build here). The build
# stage only: the runtime stage below copies /app, not this environment.
ENV NODE_OPTIONS=--max-old-space-size=6144

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
# The authorities the /api browser-trust fence accepts beyond loopback. The
# public hostname this deployment is reached by has to be named explicitly: with
# the raw address alone every API call over the domain answers 403 while the
# shell still loads, which reads as a broken feature rather than a missing
# declaration. Set SADDLE_TRUSTED_HOSTS to change them without editing the image.
CMD ["sh", "-c", "exec pm2-runtime --node-args=--expose-internals apps/cli/src/bin.ts --interpreter tsx -- web --port 3080 --host 0.0.0.0 --trusted-host ${SADDLE_TRUSTED_HOSTS:-91.99.165.95 91.99.165.95.sslip.io}"]
