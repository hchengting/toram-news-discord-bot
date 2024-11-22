FROM denoland/deno:alpine-2.1.1

EXPOSE 3000

WORKDIR /app

COPY . .

RUN deno install --frozen --entrypoint ./src/index.ts

CMD ["deno", "run", "-A", "--unstable-ffi", "./src/index.ts"]
