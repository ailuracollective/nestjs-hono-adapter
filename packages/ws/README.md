# @ailura/nestjs-platform-hono-ws

WebSocket gateways for
[`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter).
A gateway is declared the way Nest declares one, and its `path`
is registered on the same Hono application the routes hang on.

## Install

```sh
bun add @ailura/nestjs-platform-hono-ws @hono/node-ws @nestjs/websockets
```

`@ailura/nestjs-hono-adapter`, `@nestjs/common`, `hono` and
`rxjs` are peers too; install the adapter and Hono alongside it.

## Use

```ts
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { HonoWsAdapter } from '@ailura/nestjs-platform-hono-ws';

const adapter = new ServerAdapter();
const app = await NestFactory.create(AppModule, adapter);
app.useWebSocketAdapter(new HonoWsAdapter(adapter));
await app.listen(3000);
```

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
that connection closes.

A deployment whose frames are not JSON replaces the reader:

```ts
const ws = new HonoWsAdapter(adapter, {
  messageParser: (raw) => ({ event: String(raw), data: {} }),
});
ws.setMessageParser(otherParser); // or later
```

The parser answers a `{ event, data }`, or nothing, which drops
the frame. Only `path` is honoured — every other gateway option
(`port`, `namespace`, `server`, and the WebSocket server
options) is refused when the gateway starts, naming the option
it read. `@Ack()` is not wired; the acknowledgement travels back
as the echoed `id`.

The upgrade is served by the transport when it carries a
websocket helper — `hono/bun` with `bunServer()`, or the helper
a `fetchServer()` host was handed — and by `@hono/node-ws`
otherwise, which includes `nodeServer()` and the default
transport on a Node runtime.

## Documentation

See
[WebSockets](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/deployment.md#websockets)
for the gateway contract, the custom parser and the refusals.

## License

MIT
