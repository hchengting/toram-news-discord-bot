FROM denoland/deno:alpine-2.1.3

EXPOSE 3000

WORKDIR /app

COPY . /app

RUN deno install --frozen --entrypoint ./src/index.ts

CMD ["run", "-A", "--unstable-ffi", "./src/index.ts"]
