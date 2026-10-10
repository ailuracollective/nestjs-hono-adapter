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
SSE path reads is synthesized from the request's signal, and the
client address from `cf-connecting-ip`, when present. There is
no native socket, so `raw` is the carrier and `ip` is that
address, or `undefined` when the header is absent. Forwarded
headers are read only when `trustProxy` is enabled.

Static assets and WebSockets are host-specific. A host that has
them passes them to
`fetchServer({ serveStatic, upgradeWebSocket })`; asking for a
capability that was not passed throws rather than answering
nothing.

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

What cannot be honoured is refused when the gateway starts
rather than half served: a gateway with its own `port`, because
every gateway is served on the HTTP adapter's own server, and a
`namespace`, because the path is the whole address here.
`@ConnectedSocket()` receives the socket, with the `send`,
`close`, `on` and `once` Nest's contract declares. `@Ack()` is
not wired: the acknowledgement travels back as the echoed `id`,
which is what a client without a parser expects.

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
