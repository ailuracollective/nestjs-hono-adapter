# The build context is the repository root: the example imports the adapter by
# name, which the workspace resolves to packages/core.
#   docker build -t ailura-hono-google-node -f packages/examples/google/node/Dockerfile .

# Install the workspace from the lockfile and bundle the application into one file.
FROM oven/bun:1.4-slim AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile \
  && bun run build:core \
  && bun run --cwd packages/examples/google/node bundle

# Ship the bundle alone, on the Node runtime the transport needs.
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build /repo/packages/examples/google/node/dist/server.mjs ./server.mjs
EXPOSE 8080
CMD ["node", "server.mjs"]
