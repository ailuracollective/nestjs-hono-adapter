# Deployment

How to run the adapter in production: TLS, proxies, shutdown,
the Hono API, WebSockets and microservices.

## Contents

- [TLS, proxies and shutdown](#tls-proxies-and-shutdown)
- [Hono underneath](#hono-underneath)
- [WebSockets](#websockets)
- [Microservices](#microservices)

## TLS, proxies and shutdown

Pass TLS options to Nest and the adapter hands them to the
transport it was given, which serves over `https`: the options
become `@hono/node-server`'s `serverOptions` on the default
transport, and `Bun.serve`'s own with `bunServer()`.

```ts
await NestFactory.create(AppModule, new ServerAdapter(), {
  httpsOptions: { key, cert },
});
```

`getHttpServer()` returns the server Nest drives — Node's own
`http.Server` on the default transport, with `listen` and
`close` adapted onto it in place — so an application can read
its address, attach a listener, or call `closeAllConnections()`
as it did before the transports split.

`trustProxy` decides how much of a proxy's word the deployment
believes, and the levels are the ones Fastify reads from
proxy-addr:

- `false` — nothing the chain says is read, and the socket
  address is the peer.
- `true` — the whole chain is trusted, so `ip` is the leftmost
  address and `x-forwarded-proto` and `x-forwarded-host` fill
  `protocol`, `secure` and `hostname`.
- a **hop count** — that many addresses from the right are
  trusted, `ip` being the first address past them.
- a **list** — those addresses are trusted, `ip` being the first
  address to the left of them that the list does not name. The
  socket's own address is one of the addresses a list may name.

`ips` is the chain as written whenever anything is trusted.

`app.close()` stops accepting connections and then closes the
server. `return503OnClosing: true` answers `503`, with
`Connection: close`, to the requests that arrive once the
shutdown has started — from `beforeClose()`, so the destroy and
before-shutdown hooks run inside that window rather than outside
it — and `forceCloseConnections: true` destroys the connections
the server is still holding instead of waiting for them, both
from the same options object Nest accepts.

## Hono underneath

`getHono()` answers the typed `Hono` application, so a project
that already knows Hono can register its own middleware and
routes before the application listens:

```ts
const adapter = new ServerAdapter();
adapter.getHono().use('*', async (context, next) => {
  context.header('x-served-by', 'hono');
  await next();
});
```

`getInstance()` answers the same application through the
accessor Nest itself declares. This package narrows that
accessor's default type to it, so neither call needs a cast.

## Fetch hosts

A host that serves a Web `Request` and expects a Web `Response`
— Cloudflare Workers, Vercel Functions, Deno — does not hand the
application a port, so the fetch transport takes none. Nest
still initializes, and the handler is what the host exports:

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

`listen()` and `close()` do nothing; the request carrier Nest's
SSE path reads is synthesized from the request's signal. There
is no native socket, so `raw` is the carrier. By default the
carrier has no address, and `cf-connecting-ip` is ignored.

Pass `fetchHandler(app, { clientAddress })` to resolve a trusted
address supplied by the host. The resolver's result is used as
the carrier's address even with `trustProxy: false`, so only
read `cf-connecting-ip` when the host guarantees that clients
cannot forge it:

```ts
// Only on a host that guarantees cf-connecting-ip.
export default {
  fetch: fetchHandler(adapter.getHono(), {
    clientAddress: (request) =>
      request.headers.get('cf-connecting-ip') ?? undefined,
  }),
};
```

If `cf-connecting-ip` is absent, `ip` may still resolve from
`x-forwarded-for` when `trustProxy` trusts the proxy. With the
resolver above, `ip` is `undefined` only when neither header
supplies an address accepted by this configuration. Forwarded
headers are read only when `trustProxy` is enabled.

Static assets and WebSockets are host-specific. A host that has
them passes them to
`fetchServer({ serveStatic, upgradeWebSocket })`; asking for a
capability that was not passed throws rather than answering
nothing.

`upgradeWebSocket` wants a factory, because a runtime with a
server attaches an upgrade listener through one. A fetch host
has no such server, so `webSocketFromHost` fills in that half
from the helper the host publishes — no `install` to write, and
the helper goes in as it comes:

```ts
import { upgradeWebSocket } from 'hono/cloudflare-workers';

import {
  fetchServer,
  webSocketFromHost,
} from '@ailura/nestjs-hono-adapter/fetch';

const adapter = new ServerAdapter({
  transport: fetchServer({
    upgradeWebSocket: webSocketFromHost(upgradeWebSocket),
  }),
});
```

## WebSockets

Gateways have their own Nest adapter, kept behind the `./ws`
subpath so an HTTP-only deployment never resolves
`@nestjs/websockets`: it is an optional peer, and it is not
installed for the routes above. The upgrade is served by the
transport when it carries a websocket helper — `hono/bun` with
`bunServer()`, whatever host a `fetchServer()` was handed — and
by `@hono/node-ws` otherwise, which includes the default (Node)
transport. A deployment that serves gateways installs
`@hono/node-ws`; one that serves none never resolves it.

```ts
import { HonoWsAdapter } from '@ailura/nestjs-hono-adapter/ws';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new HonoWsAdapter(adapter));
await app.listen(3000);
```

A gateway is declared the way Nest declares one, and its `path`
is registered on the same Hono application the routes hang on:

```ts
@WebSocketGateway({ path: '/ws' })
class EventsGateway {
  @SubscribeMessage('ping')
  ping(@MessageBody() data: unknown): unknown {
    return { event: 'ping', data };
  }
}
```

A client sends `{ event, data, id? }` — or a bare string, which
reads as the event name — and receives `{ event, data }`, with
the `id` echoed when it asked for one. A handler that returns an
observable is subscribed per connection and unsubscribed when
that connection closes, so nothing leaks between clients.

A deployment whose frames are not JSON reads them its own way:

```ts
const ws = new HonoWsAdapter(adapter, {
  messageParser: (raw) => ({ event: String(raw), data: {} }),
});
ws.setMessageParser(otherParser); // or later
```

The parser takes what the socket delivered and answers a
`{ event, data }`, or nothing, which drops the frame. One that
throws is reported and the frame is dropped as well; the
built-in reader reads client-controlled input, so its failures
stay quiet rather than filling the log.
`bindErrorHandler(server)` attaches the error listeners
`platform-ws` attaches — on the path's server and on every
socket it hands over — and `create()` calls it for every path,
so a failing socket is logged rather than thrown out of the
event loop.

What cannot be honoured is refused when the gateway starts
rather than half served, and every option but `path` is one of
them. A gateway with its own `port` would need a second HTTP
listener, where every gateway is served on the HTTP adapter's
own server. A `namespace` has no counterpart, because the path
is the whole address here — upstream refuses one too, and points
at `@nestjs/platform-socket.io`. A `server` cannot be driven by
this transport, and the WebSocket server options
(`perMessageDeflate`, `maxPayload` and the rest) cannot be
passed to a server this adapter does not build. Each refusal
names the option it read. `@ConnectedSocket()` receives the
socket, with the `send`, `close`, `on`, `once` and `readyState`
Nest's contract declares — the pair `send` and `readyState` is
how Nest tells a native WebSocket client from a Socket.IO one,
and without both a handler that throws is answered through a
channel this socket does not have. `@Ack()` is not wired: the
acknowledgement travels back as the echoed `id`, which is what a
client without a parser expects.

A client is bound to its gateway on the first frame it sends,
rather than when the socket opens. That difference is invisible
where the helper fires an open event — `@hono/node-ws` and
`hono/bun` both do — and it is what makes a fetch host work:
Hono runs the event factory _before_ the upgrade, so a helper
there has no socket to hand an open event and
`@hono/cloudflare-workers` omits `onOpen` entirely. A client
that connects and never sends is not bound; it holds nothing the
gateway could write to, and a client that sends is bound before
its frame is delivered.

### Socket.IO

Socket.IO is a protocol of its own rather than a WebSocket, so
it has an adapter and a subpath of its own:

```ts
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
import { HonoIoAdapter } from '@ailura/nestjs-hono-adapter/socket-io';

const adapter = new ServerAdapter({ transport: nodeServer() });
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new HonoIoAdapter(app));
await app.listen(3000);
```

`HonoIoAdapter` is the counterpart of
`@nestjs/platform-socket.io`'s `IoAdapter`, so a gateway keeps
its namespaces, its rooms, its broadcasts and its
acknowledgement callbacks. Install `socket.io` beside
`@nestjs/websockets`: it is an optional peer reached through
`./socket-io` and nowhere else.

It attaches to a Node `http.Server`, which is what
`./node-server` answers with on Node and on Bun. The Bun
transport serves through `Bun.serve`, whose server is not one,
and a fetch host has no server at all. The adapter refuses both
when the gateway starts, naming the transport to serve through
instead, rather than failing inside socket.io. Its `close()`
lets the clients go without waiting for the HTTP server, because
the Node transport answers `close(callback)` without ever
invoking the callback (issue #121).

## Microservices

A microservice transport is Nest's own and never passes through
the HTTP adapter, so a hybrid application works: the routes are
served by Hono while the microservice listens on its transport,
and `app.close()` stops both.

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
