FROM denoland/deno:alpine-2.0.6

EXPOSE 3000

WORKDIR /app

COPY . .

RUN apk add libstdc++

RUN deno install --frozen --entrypoint ./src/index.ts

CMD ["deno", "run", "--allow-env", "--allow-read", "--allow-net=0.0.0.0:3000,discord.com:443,tw.toram.jp:443,toram-jp.akamaized.net:443", "--allow-ffi", "--unstable-ffi", "./src/index.ts"]
