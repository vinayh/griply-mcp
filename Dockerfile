FROM oven/bun:1-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY tsconfig.json bunfig.toml ./

ENV HOST=0.0.0.0 PORT=80
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/health || exit 1

USER bun
CMD ["bun", "run", "src/index.ts"]
