FROM oven/bun:1.1.34-alpine AS build

WORKDIR /app

COPY . .

RUN bun install --production --frozen-lockfile

RUN bun build ./src/index.ts --outdir ./dist --target bun --minify

FROM oven/bun:1.1.34-alpine

WORKDIR /app

COPY --from=build /app/dist/index.js /app/index.js

CMD ["bun", "index.js"]