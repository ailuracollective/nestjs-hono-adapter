# @ailura/nestjs-platform-hono-socket-io

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-socket-io.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-socket-io) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-socket-io.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-socket-io) [![bundle size](https://img.shields.io/badge/bundle%20size-≤900b-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/socket-io/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-socket-io)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-socket-io) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![codecov](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter/branch/main/graph/badge.svg?component=socket-io)](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

Socket.IO gateways on [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter), served by Nest's own [`@nestjs/platform-socket.io`](https://www.npmjs.com/package/@nestjs/platform-socket.io) `IoAdapter`.

It is a **compatibility bridge**: installing the package is what installs it, and an application writes no import of it. The application names the stock `IoAdapter`, and the bridge makes that adapter bind the gateway to the server the transport already built instead of one built from it.

## Install

```sh
bun add @ailura/nestjs-platform-hono-socket-io @nestjs/platform-socket.io socket.io
```

`@ailura/nestjs-hono-adapter` is a peer too; install the adapter alongside it. On Bun, install the optional `@socket.io/bun-engine` as well: it is what binds socket.io to a `Bun.serve` server.

## Use

```ts
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new IoAdapter(app));
await app.listen(3000);
```

`IoAdapter` is Nest's own; nothing here is imported. The bridge patches its `createIOServer()` once per process and, for the adapter the gateway was created for, binds a socket.io engine to that application's server where the transport offers one.

```ts
@WebSocketGateway({ namespace: '/admin' })
class AdminGateway {
  @SubscribeMessage('who')
  who(@MessageBody() name: string): string {
    return `admin for ${name}`;
  }
}
```

The protocol is `platform-socket.io`'s: namespaces, rooms, broadcasts and acknowledgement callbacks behave as they do on Express or Fastify, because `create()`, `mapPayload()`, `bindMessageHandlers()`, `bindClientDisconnect()` and `close()` are the stock class's own.

A gateway binds to the transport's server: through a socket.io engine on `Bun.serve` (`bunServer()`, or the default transport where Bun is the runtime), and on the real `node:http` server `nodeServer()` answers with. A fetch host has no server to bind to, and `Bun.serve` has none without `@socket.io/bun-engine`; both are refused by name when the gateway starts rather than failing inside socket.io.

## Documentation

See [Socket.IO](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/deployment.md#socketio) for the gateway contract, and [compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md#socket-io) for what the bridge patches.

## License

MIT
