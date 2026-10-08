# @ailura/nestjs-hono-adapter

An HTTP adapter that runs a NestJS application on
[Hono](https://hono.dev), with no Express or Fastify underneath.

Nest has no official Hono adapter. This package implements the
Nest 11/12 `AbstractHttpAdapter` contract directly on Hono:
routes are registered on a Hono application, and Hono's Web
`Request` and `Response` are translated to and from the objects
Nest reads and writes. The two published alternatives target
Nest 11 and answer incorrectly — one returns a success status to
a handler that threw, the other writes every response twice — so
owning the adapter is the smaller cost.

The layout of `src/`, the import rules it enforces and the
bundle ceilings are written down in
[docs/architecture.md](docs/architecture.md).

## Install

```sh
npm install @ailura/nestjs-hono-adapter hono @hono/node-server
```

```sh
pnpm add @ailura/nestjs-hono-adapter hono @hono/node-server
```

`@nestjs/common`, `@nestjs/core`, `hono` and `@hono/node-server`
are peer dependencies, so the application decides their
versions.

## Use

```ts
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';

import { AppModule } from './app.module.ts';

const app = await NestFactory.create(
  AppModule,
  new ServerAdapter({
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  }),
);
app.enableCors({
  credentials: true,
  origin: ['https://app.example.com'],
});
await app.listen(3000);
```

`getType()` answers `hono`, which is the value ecosystem
packages branch on.

## Options

| Option                  | Type                            | Default | Effect                                                                                                               |
| ----------------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `bodyLimit`             | `number`                        | `1 MiB` | Largest request body, in bytes; `0` removes the limit                                                                |
| `overrideGlobalObjects` | `boolean`                       | `true`  | Let `@hono/node-server` swap the global `Request` and `Response` for lighter ones; turn it off on Cloudflare Workers |
| `rawBody`               | `boolean`                       | `false` | Keep the bytes that were read in `NestRequest.rawBody`                                                               |
| `secureHeaders`         | `boolean \| object`             | `true`  | Install `hono/secure-headers`, with its defaults or with the given options                                           |
| `trustProxy`            | `boolean \| number \| string[]` | `false` | Read `x-forwarded-proto`, `x-forwarded-for` and `x-forwarded-host`                                                   |
| `views`                 | `object`                        | —       | The engine a `@Render()` handler renders with, and where templates are read from                                     |

## Where the platform adapters disagree

Where `platform-express` and `platform-fastify` answer the same
situation differently, this adapter answers as
`platform-fastify` does. That is the closer of the two in every
case that matters here: the router scores its routes rather than
matching them in registration order, the response is
encapsulated behind an object with an escape hatch to the
socket, a trailing slash is significant, a body limit is a
megabyte, and there is no `X-Powered-By` or `ETag` on the way
out.

Two defaults follow the **Express 4** behaviour instead, on
purpose: `@Query()` and a URL-encoded body are parsed with the
`qs` grammar, and an empty JSON body reads as `{}`. Both are
supersets of the flat parsers the other two platforms use, so a
controller written against either keeps reading what it expects.
Express 5 reads the query flat; anything written for `qs` nests
and stays a superset.

| Situation                                      | This adapter                                          | Express                                      | Fastify                    |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- | -------------------------- |
| A handler returns a string                     | `text/plain`                                          | `text/html`                                  | `text/plain`               |
| A handler returns raw bytes                    | `application/octet-stream`                            | serialised as JSON                           | `application/octet-stream` |
| `GET /users/` for `/users`                     | 404                                                   | matches                                      | 404                        |
| A redirect carries a body                      | no                                                    | yes                                          | no                         |
| Default body limit                             | 1 MiB                                                 | 100 KB                                       | 1 MiB                      |
| Empty JSON body                                | `{}`                                                  | `{}`                                         | 400                        |
| A body of JSON primitives                      | accepted                                              | 400                                          | accepted                   |
| `trustProxy: 1` (hops) / `['10.0.0.1']` (list) | supported, read as proxy-addr reads it                | through `trust proxy` settings               | supported                  |
| `req.params['*']` for `@Get('files/*')`        | the wildcard capture                                  | `req.params.rest` (array, path-to-regexp v8) | `req.params['*']`          |
| Middleware for every method                    | the path as a prefix, the way `router.use()` reads it | same                                         | same                       |

## Routes

Nest's path dialect is translated as the application starts:

| Nest               | Hono               |
| ------------------ | ------------------ |
| `/users/:id`       | `/users/:id`       |
| `/users/:id?`      | `/users/:id?`      |
| `/users{/:id}`     | `/users/:id?`      |
| `/users/:id(\\d+)` | `/users/:id{\\d+}` |
| `/files/*rest`     | `/files/*`         |

A path the router cannot read — `/users?`, a stray `}` or `(`,
or a group that holds more than one parameter — throws as the
application starts, rather than answering 404 later.

A wildcard is read back under `*`, the key Fastify answers it
by, and the name a route gave it is not carried over:
`@Get('files/*rest')` fills `req.params['*']` with
`reports/2024/q1.csv` for `/files/reports/2024/q1.csv`. Hono
matches a wildcard without reporting what it stood for, so the
adapter reads the capture out of the path itself.

Middleware mounted for every method — `app.use(fn)` and a
`MiddlewareConsumer` without a method — answers the path it was
given as a prefix, the way `router.use()` reads it on both
platform adapters: `use('/api')` answers `/api` and everything
under it. Middleware for one named method answers that path
alone, as a verb route reads it there.

Versioning works over URI, header, media type and the custom
strategy, including versioned redirects. A media-type version is
read out of `Accept` wherever it sits: `q` weights before it, or
an earlier media range, are skipped rather than mistaken for it.

## Query strings

`@Query()` receives the shape the platform parsers produce: a
repeated name becomes a list, `tags[]` appends, `tags[0]`
indexes and `filter[name]` nests. Values are percent-decoded,
`+` reads as a space, and `__proto__`, `constructor` and
`prototype` are dropped rather than written into the tree.

## Request bodies

The body is read when a handler reaches for it, not by
middleware:

- JSON, including the `+json` suffix types;
- URL-encoded and text bodies;
- `multipart/form-data`, through Hono's `parseBody()`; fields
  land on `NestRequest.body` and files on `NestRequest.files`;
- every other content type as a `Buffer`.

A body that does not match its content type is refused with
Nest's own `BadRequestException`, and one over `bodyLimit` with
`PayloadTooLargeException`, so both travel through the exception
layer and its filters.

`app.useBodyParser('json', { limit: '1kb' })` ignores the parser
name and sets one limit for the adapter, so the size applies to
every parser and every route, and it replaces the `bodyLimit`
option. Called without a `limit` it changes nothing.

With `rawBody: true` — the adapter option, or the same option on
`NestFactory.create` — `NestRequest.rawBody` holds the bytes
read, which is what a signed webhook needs. Multipart bodies
never fill it, because the platform parser consumes the stream.

## Responses

A returned value is answered as Nest answers it: an object as
JSON, a string as text, a number as a status. Raw bytes —
`Buffer`, `Uint8Array`, `ArrayBuffer`, a `ReadableStream` — are
answered as `application/octet-stream`, the type Fastify labels
them with, because serialising them as JSON is the one answer
that loses them. `@Header()`, `@HttpCode()`, `@Redirect()` and
`StreamableFile` are all honoured, and a declared `Content-Type`
always wins over the inferred one.

`@Res()` works, and so does `@Res({ passthrough: true })`:
Hono's own response helpers (`json`, `text`, `html`, `body`,
`redirect`, `notFound`, `newResponse`) are the imperative API
here, and the adapter makes sure the response a handler builds
that way is the one that is sent. A `Response` assigned straight
to `context.res` is sent as well.

`write`, `setHeader`, `getHeaders` and the other Node stream
members are installed only once an `@Sse()` route opens its
stream, so a handler that reaches for one on an ordinary route
fails rather than writing.

## Server-sent events

`@Sse()` is served like any other route, and its frames reach
the client as the observable emits them rather than when it
completes:

```ts
@Sse('events')
events(): Observable<MessageEvent> {
  return interval(1000).pipe(
    map((n) => ({ data: { n }, id: String(n) })),
  );
}
```

The answer carries `content-type: text/event-stream` and the
frame shape is Nest's: `data`, with an object serialised as
JSON, and, when present, `type` as `event:`, `id`, `retry` and
`comment`. A handler may answer an observable or a promise of
one, and `@Header()` reaches the stream. The status is the one
Nest computed for the route: `200` by default, and `@HttpCode()`
on the versions that carry it (11.2 and later).

A stream that fails before its first frame is answered by the
exception layer like any other failure; one that fails after a
frame has been sent ends the stream with an `error` event. A
client that disconnects unsubscribes the observable, so its
teardown runs and nothing is left ticking — and, on Nest 11.2
and later, the abort signal `@SseSignal()` injects is aborted at
the same moment. `app.close()` waits for an open stream to
finish unless `forceCloseConnections` is set, the same way it
waits for any long-lived request.

A client that walks away is noticed however the runtime says it:
by the request ending, and by the stream's own reader being
cancelled. A runtime that carries no connection of its own says
it neither way — there is nothing to close and nothing to cancel
— so it has to be told, and a Worker can: the platform aborts
the request's signal when the client goes, and
`examples/cloudflare-workers` turns that into the request
ending. A few lines of middleware, with `enable_request_signal`
set to make the platform abort it.

## Views

Rendering is left to the deployment: this adapter reads the
template and a function renders it, so no template engine
becomes a dependency of the package.

```ts
import handlebars from 'handlebars';

const adapter = new ServerAdapter({
  views: {
    directory: 'views',
    engine: (source, data) => handlebars.compile(source)(data),
  },
});
```

`engine` receives the template source and the object the handler
returned, and may answer a promise, so any engine fits. The same
two things can be named on the application, which is what Nest
declares for the purpose:

```ts
app.setBaseViewsDir('views');
app.setViewEngine('hbs');
```

A handler marks its route with `@Render('hello')`, and the
extension the engine named is appended, so the file looked up is
`views/hello.hbs`. A view that is missing is answered as
`NotFoundException`, and naming an engine before one was
configured throws, rather than rendering an empty page.

## Static assets

`app.useStaticAssets(path, options)` mounts one directory, or a
list of them, on Hono's own static handler. A request that names
no file in them travels on to the routes, so an application
keeps its own not-found answer.

```ts
app.useStaticAssets('public', {
  maxAge: '7d',
  prefix: '/public',
});
```

| Option      | Effect                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `prefix`    | Where the files hang; without it, the root                                                                                    |
| `index`     | File a directory request is answered with; `index.html` unless set                                                            |
| `maxAge`    | Writes `cache-control: public, max-age=…`; a number is milliseconds, a string is read as `ms`, `s`, `m`, `h`, `d`, `w` or `y` |
| `immutable` | Adds `immutable` to that header, and needs `maxAge`                                                                           |

`redirect` is accepted and not acted on: a directory request is
answered with its index whether or not the path ends in a slash,
so a redirect would only add a round trip. The options Hono's
handler decides for itself are refused when they are passed, so
a deployment is told at startup rather than noticing later:
`setHeaders`, `extensions`, `fallthrough: false`, `dotfiles`,
`index: false`, `etag: false`, and `immutable` without a
`maxAge`. An ETag is always written.

## Request-level security

`secureHeaders: true` installs `hono/secure-headers` for the
answers the adapter builds, which the platform adapters do not
do by default.

Nest's own request-level security features — the security
headers and the CSRF check it calls through
`registerSecurityHook()` — are registered as Hono middleware in
front of every route. The hook is handed the request it reads
and the raw response it writes, the same two objects the Fastify
adapter gives it, and the transport merges the headers it sets
into whatever the route answers.

The hook is installed as an own property rather than declared as
a method: `AbstractHttpAdapter` declares it only in Nest
versions published after 12.0.3, and this package compiles
against `>=11 <13`, so one build has to answer a Nest that
declares the method and one that does not.

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

`getInstance()` answers the same application, which is the
untyped accessor Nest itself declares.

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

## CORS

`app.enableCors()` records the options instead of installing
Nest's Express middleware: the adapter answers with Hono's own
`cors` in front of every route.

An origin may be a string, a list, a regular expression, `'*'`,
or a callback in the shape Nest documents:

```ts
app.enableCors({
  origin: (origin, respond) => {
    respond(
      undefined,
      allowed.has(origin ?? '') ? origin : false,
    );
  },
});
```

The callback runs once per request, may answer an error to fail
the request outright, and is awaited, so an asynchronous
decision works. `preflightContinue: true` answers nothing
itself: the preflight headers are copied onto the response and
the router answers, which is what an application with its own
`OPTIONS` route wants.

What the middleware answers when nothing is named follows the
platform adapters: a preflight reflects the
`Access-Control-Request-Headers` it arrived with rather than a
list the deployment never wrote, a `max-age` of a day goes out
by default, and an origin of `'*'` is answered literally, with
no `Vary: Origin` to cache around it. An origin named with
`true` or with a list is echoed back instead, which is what a
deployment with credentials needs.

Allowed origins are passed in by the application, which reads
them from its own configuration. This package reads no
environment variable, so one deployment policy is not baked into
the library.

## Requirements

- Node 22.12 or later (22.x and 24.x tested; 26.x ready as it
  enters LTS).
- Nest 11 or 12.
- Hono 4 and `@hono/node-server` 2.

## Development

pnpm installs and runs the workspace; the gates are oxlint,
oxfmt, `tsc`, vitest and size-limit.

```sh
pnpm install
pnpm run check
```

`pnpm run check` is exactly what CI runs: lint, format,
typecheck, test, build and the bundle size gate.

Before changing a file, read
[docs/architecture.md](docs/architecture.md): it maps the
regions of `src/`, the four dependency rules between them, what
the frozen Node surface is, and why the bundle ceilings behave
the way they do.

The cases start a real application on an ephemeral port and talk
to it over `fetch`, so they cover the path and query dialects,
every body type, the response forms, event streams, CORS, views,
static assets, TLS selection, proxy headers and shutdown. The
TLS case runs its check in a child Node process, because the
suite has to see the server class the way a consumer would, from
a plain Node process rather than from the test runner.

The adapter builds against two Nest majors. The suite runs
against the version the lockfile pins, and the CI compatibility
job installs Nest 11 and 12 on Node 22 and 24 — every
`@nestjs/*` package moves together, because a mixed install is
what a gateway or a microservice case would fail on rather than
the adapter. To run it locally, move the four packages in one
call and put them back afterwards:

```sh
pnpm add --save-exact @nestjs/common@11.x @nestjs/core@11.x \
  @nestjs/websockets@11.x @nestjs/microservices@11.x
pnpm run check
pnpm install
```

The tests are transpiled from the root `tsconfig.json` through
swc, and the fixtures are Nest controllers whose decorators are
the legacy kind, which is why that file turns
`experimentalDecorators` and `emitDecoratorMetadata` on. The
library declares no decorator, so neither flag changes what
`pnpm run build` emits.

## License

MIT
