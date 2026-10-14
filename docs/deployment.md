# Deployment

## TLS, proxies and shutdown

TLS options passed to Nest reach the transport: `Bun.serve`'s on
the default transport, `@hono/node-server`'s `serverOptions`
with `nodeServer()`. `getHttpServer()` returns the server Nest
drives — Node's `http.Server` on Node, with `listen` and `close`
adapted in place.

```ts
await NestFactory.create(AppModule, new ServerAdapter(), {
  httpsOptions: { key, cert },
});
```

`trustProxy` sets how much of a proxy's word the deployment
believes; the levels are Fastify's, from proxy-addr, and `ips`
is the chain as written whenever anything is trusted:

- `false` — nothing is read; the peer is the address.
- `true` — the whole chain is trusted: `ip` is leftmost, and
  `x-forwarded-proto` and `x-forwarded-host` fill `protocol`,
  `secure` and `hostname`.
- a **hop count** — that many from the right; `ip` is the first
  past them.
- a **list** — those addresses are trusted; `ip` is the first to
  their left the list omits, and the socket's address may be
  named.

`app.close()` stops accepting connections then closes the
server. `return503OnClosing: true` answers `503` with
`Connection: close` once shutdown starts — from `beforeClose()`,
so the destroy and before-shutdown hooks run in that window —
and `forceCloseConnections: true` destroys held connections
instead of waiting. Both come from Nest's options object.

## Hono underneath

`getHono()` answers the typed `Hono` application, so a project
that knows Hono can register middleware and routes before the
application listens; `getInstance()` answers the same
application through the accessor Nest declares, whose default
type this package narrows, so neither needs a cast.

```ts
const adapter = new ServerAdapter();
adapter.getHono().use('*', async (context, next) => {
  context.header('x-served-by', 'hono');
  await next();
});
```

## Fetch hosts

A host serving a Web `Request` and expecting a Web `Response` —
Cloudflare Workers, Vercel Functions, Deno — gives the
application no port, so the fetch transport takes none; Nest
still initializes and the host exports the handler:

```ts
import {
  fetchHandler,
  fetchServer,
} from '@ailura/nestjs-hono-adapter/fetch';

const adapter = new ServerAdapter({ transport: fetchServer() });
const app = await NestFactory.create(AppModule, adapter);
await app.init();

export default { fetch: fetchHandler(adapter.getHono()) };
```

`close()` does nothing and `listen()` rejects, naming the fetch
host, which owns the request loop. The SSE path's request
carrier is synthesized from the request signal; with no native
socket, `raw` is the carrier, with no address by default and
`cf-connecting-ip` ignored.
`fetchHandler(app, { clientAddress })` resolves a host-supplied
trusted address, used as the carrier's address even with
`trustProxy: false`; read `cf-connecting-ip` only when the host
guarantees clients cannot forge it. `ip` resolves from that
header, else from `x-forwarded-for` when `trustProxy` trusts the
proxy, and is `undefined` only when neither supplies an address
this configuration accepts. Forwarded headers are read only when
`trustProxy` is enabled.

Static assets and WebSockets are host-specific: pass them to
`fetchServer({ serveStatic, upgradeWebSocket })`; asking for one
not passed throws rather than answering nothing.
`upgradeWebSocket` wants a factory, because a runtime with a
server attaches an upgrade listener through one; a fetch host
has none, so `webSocketFromHost` fills that half from the helper
the host publishes — no `install` to write, the helper going in
as it comes:
`fetchServer({ upgradeWebSocket: webSocketFromHost(upgradeWebSocket) })`.

## WebSockets

Gateways have their own Nest adapter,
`@ailura/nestjs-platform-hono-ws`, so an HTTP-only deployment
never resolves `@nestjs/websockets` — an optional peer, not
installed for the routes above. The transport serves the upgrade
when it carries a websocket helper (`hono/bun` with
`bunServer()` where Bun is present, or whatever host a
`fetchServer()` was given), else `@hono/node-ws`, which includes
`nodeServer()` and the default transport on Node. Installing the
ws package resolves the optional peer `@hono/node-ws`, because
that entrypoint eagerly imports it even when the transport
provides its own helper; not installing it never resolves it.

```ts
import { HonoWsAdapter } from '@ailura/nestjs-platform-hono-ws';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new HonoWsAdapter(adapter));
await app.listen(3000);
```

A gateway is declared as Nest declares one, its `path`
registered on the same Hono application the routes hang on. A
client sends `{ event, data, id? }` — or a bare string, read as
the event name — and receives `{ event, data }`, with `id`
echoed when asked. A handler returning an observable is
subscribed per connection and unsubscribed on close, so nothing
leaks between clients. A client binds on its first frame, not on
open — invisible where the helper fires an open event
(`@hono/node-ws`, `hono/bun`), and what makes a fetch host work,
since Hono runs the event factory _before_ the upgrade, so a
helper there has no socket for an open event and
`@hono/cloudflare-workers` omits `onOpen`; one that sends is
bound before its frame is delivered, and one that never sends is
not bound and holds nothing the gateway could write to.

Non-JSON frames are read with `messageParser`
(`new HonoWsAdapter(adapter, { messageParser: (raw) => ({ event, data }) })`,
or later `setMessageParser(parser)`): it answers a
`{ event, data }` or nothing to drop the frame; one that throws
is reported and dropped, and the built-in reader (reading
client-controlled input) stays quiet rather than filling the
log. `bindErrorHandler(server)` attaches the listeners
`platform-ws` attaches — on the path's server and every socket
it hands over — and `create()` calls it for every path, so a
failing socket is logged rather than thrown out of the event
loop. Any option but `path` is refused when the gateway starts
rather than half served: a `port` would need a second HTTP
listener, where every gateway is served on the HTTP adapter's
own server; a `namespace` has no counterpart, the path being the
whole address (upstream refuses one too, pointing at
`@nestjs/platform-socket.io`); a `server` cannot be driven by
this transport; and the WebSocket server options
(`perMessageDeflate`, `maxPayload` and the rest) cannot be
passed to a server this adapter does not build. Each refusal
names the option it read. `@ConnectedSocket()` receives the
socket with `send`, `close`, `on`, `once` and `readyState` as
Nest's contract declares — `send` and `readyState` together are
how Nest tells a native WebSocket client from a Socket.IO one,
and without both a throwing handler is answered through a
channel this socket lacks. `@Ack()` is not wired; the
acknowledgement travels back as the echoed `id`, what a client
without a parser expects.

### Socket.IO

Socket.IO is a protocol of its own rather than a WebSocket, with
an adapter and package of its own:

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

`HonoIoAdapter` is the counterpart of
`@nestjs/platform-socket.io`'s `IoAdapter`, so a gateway keeps
its namespaces, rooms, broadcasts and acknowledgement callbacks.
Install `socket.io` beside `@nestjs/websockets`: an optional
peer reached only through
`@ailura/nestjs-platform-hono-socket-io`. It attaches to a Node
`http.Server`, which `./node-server` answers with on Node and
Bun; the Bun transport serves through `Bun.serve`, whose server
is not one, and a fetch host has no server — the adapter refuses
both when the gateway starts, naming the transport to serve
through instead, rather than failing inside socket.io. Its
`close()` closes the listener a standalone gateway opened and
only that one: the server an attached gateway shares belongs to
the transport, which closes it in its own shutdown, so the
adapter lets the clients go and leaves that listener alone. Port
zero requests attachment and is refused when no Node server is
available; an explicit nonzero port opens a separate listener
the adapter owns and closes during shutdown, even when the
gateway uses a namespace.

## Microservices

A microservice transport is Nest's own and never passes through
the HTTP adapter, so a hybrid application works: Hono serves the
routes while the microservice listens on its transport, and
`app.close()` stops both.

```ts
const app = await NestFactory.create(
  AppModule,
  new ServerAdapter(),
);
app.connectMicroservice({
  options: { host: '127.0.0.1', port: 4000 },
  transport: Transport.TCP,
});
await app.startAllMicroservices();
await app.listen(3000);
```
