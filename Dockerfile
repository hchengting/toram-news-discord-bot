FROM node:jod-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM node:jod-alpine

WORKDIR /app

COPY --from=build /app/dist/index.js /app/index.js

CMD ["node", "--experimental-sqlite", "index.js"]