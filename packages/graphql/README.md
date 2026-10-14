# @ailura/nestjs-platform-hono-graphql

The GraphQL bridge of
[`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter).
It lets the **stock**
[`@nestjs/apollo`](https://www.npmjs.com/package/@nestjs/apollo)
driver answer on Hono.

`@nestjs/graphql` ships no platform adapter of its own; its
**drivers** are the platform-coupled half.
`ApolloDriver.registerServer` branches on
`httpAdapter.getType()` and throws
`No support for current HttpAdapter` for anything that is not
Express or Fastify. This package replaces that one branch and
mounts the endpoint through the adapter.

## You write no import

Installing the package is what installs the bridge. The
adapter's compatibility region resolves the package out of your
own tree and registers the bridge it publishes, so an
application names nothing from here:

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

## Install

```sh
bun add @ailura/nestjs-platform-hono-graphql
```

Peers on `@nestjs/apollo`, `@nestjs/graphql`, `@apollo/server`
and `graphql`; it does nothing without them.

## What it covers

Queries and mutations, code-first and schema-first, the GraphiQL
landing page, `OPTIONS`, and a `context` factory called exactly
as `@as-integrations/express5` calls it — with the adapter's own
request object under `req`.

Subscriptions are not covered: `ApolloDriver.start()` opens a
`GqlSubscriptionService` on the adapter's HTTP server, which a
transport serving no socket has nothing to attach to. That is
the WebSocket island's work. `@nestjs/mercurius` is not covered
either.

## See also

[docs/compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md)
— the region, the discovery, and what a bridge costs.
