# First stage: build
FROM node:22.10.0-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Second stage: run
FROM node:22.10.0-alpine

WORKDIR /app

COPY --from=build /app/dist/index.js /app/index.js

CMD ["node", "--experimental-sqlite", "index.js"]