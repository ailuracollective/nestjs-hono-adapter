# @ailura/nestjs-platform-hono-ws

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-ws.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-ws) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-ws.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-ws) [![bundle size](https://img.shields.io/badge/bundle%20size-≤1.2kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/ws/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-ws)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-ws) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![codecov](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter/branch/main/graph/badge.svg?component=ws)](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

WebSocket gateways on [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter), served by Nest's own [`@nestjs/platform-ws`](https://www.npmjs.com/package/@nestjs/platform-ws) `WsAdapter`.

It is a **compatibility bridge**: installing the package is what installs it, and an application writes no import of it. The application names the stock `WsAdapter`, and the bridge makes that adapter register each gateway's `path` on the Hono application the routes hang on.

## Install

```sh
bun add @ailura/nestjs-platform-hono-ws @nestjs/platform-ws @nestjs/websockets
```

`@ailura/nestjs-hono-adapter` and `hono` are peers too; install the adapter and Hono alongside it.

## Use

```ts
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new WsAdapter(app));
await app.listen(3000);
```

`WsAdapter` is Nest's own; nothing here is imported. The bridge patches its `create()` once per process and, for the adapter the gateway was created for, registers the path on that adapter's Hono application.

```ts
@WebSocketGateway({ path: '/ws' })
class EventsGateway {
  @SubscribeMessage('ping')
  ping(@MessageBody() data: unknown): unknown {
    return { event: 'ping', data };
  }
}
```

The wire protocol is `platform-ws`'s: the frame goes through `messageParser` (JSON by default, replaceable with the constructor option or `setMessageParser()`), the handler's return value is serialized back to the client, and a falsy return sends nothing. `bindMessageHandlers()`, `bindErrorHandler()`, `bindClientDisconnect()`, `close()` and `dispose()` are `platform-ws`'s own, so a throwing handler, a parser failure and a shutdown are answered the way Nest answers them. `@ConnectedSocket()` gets a socket with `send`, `close`, `terminate`, `readyState` and `on` / `off` / `once` / `emit`; this package exports it as the type `GatewayClient`, so a gateway types the parameter it receives.

The upgrade is served by the transport when it carries a websocket helper — `bunServer()`, or the helper a `fetchServer()` host was handed — and by the stock `ws.Server` on the transport's own HTTP server otherwise, which includes `nodeServer()` and the default transport on Node.

Only `path` is honoured. A non-zero `port`, a `namespace`, a `server` and the WebSocket server options (`perMessageDeflate`, `maxPayload` and the rest) are refused when the gateway starts, naming the option it read.

### On a Worker

A Worker resolves no bare name at run time, so it names the bridge itself, and it seeds the package Nest's own `WsAdapter` reads, which a Worker cannot load — the bridge replaces the one member that builds a server, so no `ws.Server` is ever built there and only the name is read.

```ts
import { registerBridge } from '@ailura/nestjs-hono-adapter';
import { bridge } from '@ailura/nestjs-platform-hono-ws';
import { loadPackageSync } from '@nestjs/common/utils/load-package.util.js';

loadPackageSync('ws', 'WsAdapter', () => ({}));
registerBridge(bridge);
```

The upgrade itself is the platform's own helper, handed to the transport:

```ts
import { upgradeWebSocket } from '@hono/cloudflare-workers';

const transport = fetchServer({
  upgradeWebSocket: webSocketFromHost(upgradeWebSocket),
});
```

## Documentation

See [WebSockets](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/deployment.md#websockets) for the gateway contract, and [compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md#ws) for what the bridge patches.

## License

MIT
