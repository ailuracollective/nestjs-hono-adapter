# @ailura/nestjs-platform-hono-socket-io

Socket.IO gateways for [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter). `HonoIoAdapter` is the counterpart of `@nestjs/platform-socket.io`'s `IoAdapter`, so a gateway keeps its namespaces, its rooms, its broadcasts and its acknowledgement callbacks.

## Install

```sh
bun add @ailura/nestjs-platform-hono-socket-io socket.io @nestjs/websockets
```

`@ailura/nestjs-hono-adapter`, `@nestjs/common`, `hono` and `rxjs` are peers too; install the adapter and Hono alongside it. A deployment that serves through the Bun transport adds the optional `@socket.io/bun-engine`:

```sh
bun add @socket.io/bun-engine
```

## Use

It attaches to a Node `http.Server`, which is what `@ailura/nestjs-hono-adapter/node-server` answers with on Node and on Bun:

```ts
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
import { HonoIoAdapter } from '@ailura/nestjs-platform-hono-socket-io';

const adapter = new ServerAdapter({ transport: nodeServer() });
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new HonoIoAdapter(app));
await app.listen(3000);
```

Where the transport serves through `Bun.serve` — the default `new ServerAdapter()` or `bunServer()` — and `@socket.io/bun-engine` is installed, the adapter binds a socket.io engine to that server instead, and the same bootstrap works unchanged.

A fetch host has no server to bind either to; the adapter refuses one when the gateway starts, as it refuses a `Bun.serve` deployment without `@socket.io/bun-engine`, naming the transport or the package to use instead.

Port zero requests attachment and is refused when no Node server is available. An explicit nonzero gateway port opens a separate listener, which the adapter owns and closes during shutdown, including when the gateway uses a namespace.

## Documentation

See [Socket.IO](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/deployment.md#socketio) for the attachment rules and shutdown behaviour.

## License

MIT
