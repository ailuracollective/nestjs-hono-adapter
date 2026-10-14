# @ailura/nestjs-platform-hono-socket-io

Socket.IO gateways for
[`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter).
`HonoIoAdapter` is the counterpart of
`@nestjs/platform-socket.io`'s `IoAdapter`, so a gateway keeps
its namespaces, its rooms, its broadcasts and its
acknowledgement callbacks.

## Install

```sh
bun add @ailura/nestjs-platform-hono-socket-io socket.io @nestjs/websockets
```

`@ailura/nestjs-hono-adapter`, `@nestjs/common`, `hono` and
`rxjs` are peers too; install the adapter and Hono alongside it.

## Use

It attaches to a Node `http.Server`, which is what
`@ailura/nestjs-hono-adapter/node-server` answers with on Node
and on Bun:

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

The Bun transport serves through `Bun.serve`, whose server is
not a Node one, and a fetch host has no server at all; the
adapter refuses both when the gateway starts, naming the
transport to serve through instead.

Port zero requests attachment and is refused when no Node server
is available. An explicit nonzero gateway port opens a separate
listener, which the adapter owns and closes during shutdown,
including when the gateway uses a namespace.

## Documentation

See
[Socket.IO](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/deployment.md#socketio)
for the attachment rules and shutdown behaviour.

## License

MIT
