# Deployment

How to run the adapter in production: TLS, proxies, shutdown,
the Hono API, WebSockets and microservices.

## Contents

- [TLS, proxies and shutdown](#tls-proxies-and-shutdown)
- [Hono underneath](#hono-underneath)
- [WebSockets](#websockets)
- [Microservices](#microservices)

## TLS, proxies and shutdown

Pass Node's TLS options to Nest and the adapter builds an
`https.Server`:

```ts
await NestFactory.create(AppModule, new ServerAdapter(), {
  httpsOptions: { key, cert },
});
```

`getHttpServer()` returns that server, so an application can
read its address or attach a listener.

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

## WebSockets

Gateways have their own Nest adapter, kept behind the `./ws`
subpath so an HTTP-only deployment never resolves
`@nestjs/websockets` or `@hono/node-ws`: both are optional
peers, and neither is installed for the routes above.

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
