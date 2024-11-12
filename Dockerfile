FROM denoland/deno:alpine-2.0.6

EXPOSE 3000

WORKDIR /app

COPY . .

RUN deno install --frozen --entrypoint ./src/index.ts

CMD ["deno", "run", "--allow-env", "--allow-net=0.0.0.0:3000,discord.com:443,tw.toram.jp:443", "--allow-ffi", "--unstable-ffi", "./src/index.ts"]
