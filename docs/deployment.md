# Deployment

## TLS, proxies and shutdown

TLS options passed to Nest reach the transport: `Bun.serve`'s on the default transport, `@hono/node-server`'s `serverOptions` with `nodeServer()`. `getHttpServer()` returns the server Nest drives — Node's `http.Server` on Node, with `listen` and `close` adapted in place.

```ts
await NestFactory.create(AppModule, new ServerAdapter(), {
  httpsOptions: { key, cert },
});
```

Only the fields Bun reads are forwarded — `key`, `cert`, `ca`, `passphrase`, `ciphers`, `secureOptions`, `requestCert` and `rejectUnauthorized`. Bun has no `pfx`, and it serves plain HTTP for a `tls` object it cannot use, so a certificate that leaves neither `key` nor `cert` behind is refused at startup instead of being answered in the clear. The Node transport hands the same object to `node:https`, which reads `pfx` itself.

`trustProxy` sets how much of a proxy's word the deployment believes; the levels are Fastify's, from proxy-addr, and `ips` is the chain as written whenever anything is trusted:

- `false` — nothing is read; the peer is the address.
- `true` — the whole chain is trusted: `ip` is leftmost, and `x-forwarded-proto` and `x-forwarded-host` fill `protocol`, `secure` and `hostname`.
- a **hop count** — that many from the right; `ip` is the first past them.
- a **list** — those addresses are trusted; `ip` is the first to their left the list omits, and the socket's address may be named.

`app.close()` stops accepting connections then closes the server. `return503OnClosing: true` answers `503` with `Connection: close` once shutdown starts — from `beforeClose()`, so the destroy and before-shutdown hooks run in that window — and `forceCloseConnections: true` destroys held connections instead of waiting. Both come from Nest's options object.

## Hono underneath

`getHono()` answers the typed `Hono` application, so a project that knows Hono can register middleware and routes before the application listens; `getInstance()` answers the same application through the accessor Nest declares, whose default type this package narrows, so neither needs a cast.

```ts
const adapter = new ServerAdapter();
adapter.getHono().use('*', async (context, next) => {
  context.header('x-served-by', 'hono');
  await next();
});
```

## Fetch hosts

A host serving a Web `Request` and expecting a Web `Response` — Cloudflare Workers, Vercel Functions, Deno — gives the application no port, so the fetch transport takes none; Nest still initializes and the host exports the handler:

```ts
import { fetchHandler, fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

const adapter = new ServerAdapter({ transport: fetchServer() });
const app = await NestFactory.create(AppModule, adapter);
await app.init();

export default { fetch: fetchHandler(adapter.getHono()) };
```

`close()` does nothing and `listen()` rejects, naming the fetch host, which owns the request loop. The SSE path's request carrier is synthesized from the request signal; with no native socket, `raw` is the carrier, with no address by default and `cf-connecting-ip` ignored. `fetchHandler(app, { clientAddress })` resolves a host-supplied trusted address, used as the carrier's address even with `trustProxy: false`; read `cf-connecting-ip` only when the host guarantees clients cannot forge it. `ip` resolves from that header, else from `x-forwarded-for` when `trustProxy` trusts the proxy, and is `undefined` only when neither supplies an address this configuration accepts. Forwarded headers are read only when `trustProxy` is enabled.

Static assets and WebSockets are host-specific: pass them to `fetchServer({ serveStatic, upgradeWebSocket })`; asking for one not passed throws rather than answering nothing. `upgradeWebSocket` wants a factory, because a runtime with a server attaches an upgrade listener through one; a fetch host has none, so `webSocketFromHost` fills that half from the helper the host publishes — no `install` to write, the helper going in as it comes: `fetchServer({ upgradeWebSocket: webSocketFromHost(upgradeWebSocket) })`.

## WebSockets

Gateways are served by Nest's own `@nestjs/platform-ws` `WsAdapter`, fitted to Hono by the bridge package `@ailura/nestjs-platform-hono-ws`: installing it is what installs the bridge, and an application writes no import of it. An HTTP-only deployment never resolves `@nestjs/websockets`. The transport serves the upgrade when it carries a websocket helper (`hono/bun` with `bunServer()` where Bun is present, or whatever host a `fetchServer()` was given); where it carries none — `nodeServer()` and the default transport on Node — the stock `ws.Server` serves on the transport's own HTTP server, the way `platform-ws` always served one.

```ts
import { WsAdapter } from '@nestjs/platform-ws';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new WsAdapter(app));
await app.listen(3000);
```

A gateway is declared as Nest declares one, its `path` registered on the same Hono application the routes hang on. The wire protocol is `platform-ws`'s: the frame goes through `messageParser` (JSON by default, replaceable with the constructor option or `setMessageParser()`), the handler's return value is serialized back, and a falsy return sends nothing; `bindMessageHandlers()`, `bindErrorHandler()`, `bindClientDisconnect()`, `close()` and `dispose()` are that adapter's own, so a throwing handler and a shutdown are answered the way Nest answers them. A client binds on whichever event of the transport's helper fires first — invisible where the helper fires `onOpen` (`hono/bun`), and what makes a fetch host work, since Hono runs the event factory _before_ the upgrade, so a helper there has no socket for an open event and `@hono/cloudflare-workers` omits `onOpen`; one that sends is bound before its frame is delivered, and one that never sends is not bound and holds nothing the gateway could write to.

`messageParser` is `platform-ws`'s: a parser that throws is reported and the frame dropped, and the built-in reader (reading client-controlled input) stays quiet rather than filling the log. `bindErrorHandler(server)` attaches the listeners `platform-ws` attaches — on the path's server and every socket it hands over — and the bridge calls it for every path, so a failing socket is logged rather than thrown out of the event loop. Any option but `path` is refused when the gateway starts rather than half served: a `port` would need a second HTTP listener, where every gateway is served on the HTTP adapter's own server; a `namespace` has no counterpart, the path being the whole address (upstream refuses one too, pointing at `@nestjs/platform-socket.io`); a `server` cannot be driven by this transport; and the WebSocket server options (`perMessageDeflate`, `maxPayload` and the rest) cannot be passed to a server this adapter does not build. Each refusal names the option it read. `@ConnectedSocket()` receives the socket — exported as `GatewayClient`, so a gateway can type it — with `send`, `close`, `terminate`, `readyState` and `on` / `off` / `once` / `emit`; `send` and `readyState` together are how Nest tells a native WebSocket client from a Socket.IO one, and without both a throwing handler is answered through a channel this socket lacks. `@Ack()` is not wired by `platform-ws` either; a reply travels back as whatever the handler returned.

### On a Worker

A Worker answers an upgrade itself, so the transport is given the platform's helper — `fetchServer({ upgradeWebSocket: webSocketFromHost(upgradeWebSocket) })`, where the helper is `@hono/cloudflare-workers`'s — and two things it cannot answer are answered by the deployment: the bridge it cannot look up, and the `ws` package it cannot load, which Nest's own `WsAdapter` reads in its constructor.

```ts
import { registerBridge } from '@ailura/nestjs-hono-adapter';
import { bridge } from '@ailura/nestjs-platform-hono-ws';
import { loadPackageSync } from '@nestjs/common/utils/load-package.util.js';

loadPackageSync('ws', 'WsAdapter', () => ({}));
registerBridge(bridge);
```

[compatibility.md](compatibility.md#a-runtime-that-resolves-no-specifier) has the rest, and `packages/examples/cloudflare/fetch` is a Worker that answers a gateway.

### Socket.IO

Socket.IO is a protocol of its own rather than a WebSocket, and Nest serves it with its own `@nestjs/platform-socket.io` `IoAdapter`. That adapter is the adapter here too, fitted to Hono by the bridge package `@ailura/nestjs-platform-hono-socket-io`: installing it is what installs the bridge, and an application writes no import of it.

```ts
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new IoAdapter(app));
await app.listen(3000);
```

Install `socket.io` beside it, which the stock adapter needs anyway. The bridge replaces `createIOServer()`, the one member that builds a server, so a gateway binds to the transport's own server instead of one built from it. Where the transport serves through `Bun.serve` the gateway is served by a socket.io engine bound to that server — install the optional `@socket.io/bun-engine` peer alongside it, and the example above works unchanged with `new ServerAdapter()` or `bunServer()`. Where the transport answers with a real `node:http` server, which `nodeServer()` does on Node and on Bun, socket.io attaches to it the way it always has. A fetch host has no server to bind either to, and a `Bun.serve` deployment without the engine has none either: the gateway is refused when it starts, naming the transport or the package to use instead, rather than failing inside socket.io. The Bun server carries one native slot, so it serves one socket.io server per application.

Everything else is the stock class — `create()`, `mapPayload()`, `bindMessageHandlers()`, `bindClientDisconnect()` and `close()` — so a gateway keeps its namespaces, rooms, broadcasts, acknowledgement callbacks and its shutdown: a gateway that asked for a listener of its own with an explicit nonzero port releases it, and one attached to the application's server is closed the way `IoAdapter` closes it.

## Microservices

A microservice transport is Nest's own and never passes through the HTTP adapter, so a hybrid application works: Hono serves the routes while the microservice listens on its transport, and `app.close()` stops both.

```ts
const app = await NestFactory.create(AppModule, new ServerAdapter());
app.connectMicroservice({
  options: { host: '127.0.0.1', port: 4000 },
  transport: Transport.TCP,
});
await app.startAllMicroservices();
await app.listen(3000);
```
