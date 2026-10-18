# @ailura/nestjs-platform-hono-graphql

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-graphql.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-graphql) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-graphql.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-graphql) [![bundle size](https://img.shields.io/badge/bundle%20size-≤2.1kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/graphql/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-graphql)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-graphql) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![codecov](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter/branch/main/graph/badge.svg?component=graphql)](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter) [![GitHub license](https://img.shields.io/github/license/ailuracollective/nestjs-hono-adapter.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

The GraphQL bridge of [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter). It lets the **stock** [`@nestjs/apollo`](https://www.npmjs.com/package/@nestjs/apollo) driver answer on Hono.

It is a **compatibility bridge**: installing the package is what installs it, and an application writes no import of it. The adapter's compatibility region resolves the package out of your own tree and registers the bridge it publishes, so the application names nothing from here.

`@nestjs/graphql` ships no platform adapter of its own; its **drivers** are the platform-coupled half. `ApolloDriver.registerServer` branches on `httpAdapter.getType()` and throws `No support for current HttpAdapter` for anything that is not Express or Fastify. This package replaces that one branch and mounts the endpoint through the adapter.

## Install

```sh
bun add @ailura/nestjs-platform-hono-graphql
```

Peers on `@nestjs/apollo`, `@nestjs/graphql`, `@apollo/server` and `graphql`, without which it does nothing, and on the optional `graphql-ws`, loaded only where subscriptions are served.

## Use

```ts
import { Module } from '@nestjs/common';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloDriver, // the one Nest publishes
      typeDefs: `type Query { hello: String }`,
      resolvers: { Query: { hello: () => 'world' } },
    }),
  ],
})
export class AppModule {}
```

The application names the stock driver and imports nothing from here.

## What it covers

Queries and mutations, code-first and schema-first, the GraphiQL landing page, `OPTIONS`, and a `context` factory called exactly as `@as-integrations/express5` calls it — with the adapter's own request object under `req`.

Subscriptions answer wherever the transport carries a websocket helper — `bunServer()`, or the helper a `fetchServer()` host was handed. `ApolloDriver.start()` opens a `GqlSubscriptionService`; where the helper is the socket's own, the bridge replaces that service's `initialize()` and mounts the upgrade on the Hono application at the subscriptions path, feeding `graphql-ws` from the helper. Where there is no helper — `nodeServer()`, and the default transport on Node — the stock service attaches its `ws` server to the HTTP server's `upgrade` event and answers as it always did. `graphql-ws` is an optional peer, resolved only where subscriptions are served. `@nestjs/mercurius` is not covered either.

## Documentation

[docs/compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md#graphqlapollo) — what the bridge patches, and what it costs.

## License

MIT
