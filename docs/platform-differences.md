# Platform differences, routes, bodies and responses

How this adapter answers where Nest's own platform adapters
disagree, and how it reads Nest's path, query and body dialects.

## Contents

- [Where the platform adapters disagree](#where-the-platform-adapters-disagree)
- [Routes](#routes)
- [Query strings](#query-strings)
- [Request bodies](#request-bodies)
- [Responses](#responses)
- [Instrumentation hooks](#instrumentation-hooks)
- [What this adapter does not implement](#what-this-adapter-does-not-implement)

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
`qs` grammar, and an empty JSON body reads as `{}`. Express 5
reads the query flat, as `platform-fastify` does, but bracket
syntax nests here, where a flat parser keeps `filter[name]` as a
literal key. A handler that reads those keys may need a change
when it moves to this adapter.

| Situation                                      | This adapter                                          | Express                                      | Fastify                    |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- | -------------------------- |
| A handler returns a string                     | `text/plain`                                          | `text/html`                                  | `text/plain`               |
| `res.send('…')` on a route a module registered | `text/html`                                           | `text/html`                                  | —                          |
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

| Nest              | Hono              |
| ----------------- | ----------------- |
| `/users/:id`      | `/users/:id`      |
| `/users/:id?`     | `/users/:id?`     |
| `/users{/:id}`    | `/users/:id?`     |
| `/users/:id(\d+)` | `/users/:id{\d+}` |
| `/files/*rest`    | `/files/*`        |

A path the router cannot read — `/users?`, a stray `}` or `(`,
or a group that holds more than one parameter — throws as the
application starts, rather than answering 404 later.

A wildcard is read back under `*`, the key Fastify answers it
by, and the name a route gave it is not carried over:
`@Get('files/*rest')` fills `req.params['*']` with
`reports/2024/q1.csv` for `/files/reports/2024/q1.csv`. Hono
matches a wildcard without reporting what it stood for, so the
adapter reads the capture out of the path itself. A wildcard
whose escape stands for no character cannot be decoded:
`/files/%FF` is a `400`, the answer Express gives for it.

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

When the `./multipart` upload island is imported, the request
path leaves a multipart body for one of its interceptors to
consume instead, as `@nestjs/platform-fastify` does; a multipart
route without an upload interceptor then reads no `body` and no
`files`.

A body that does not match its content type is refused with
Nest's own `BadRequestException`, and one over `bodyLimit` with
`PayloadTooLargeException`, so both travel through the exception
layer and its filters.

A textual payload is decoded with the `charset` its
`content-type` declares: `utf-8`, `utf-16le` and `utf-16be`,
with or without the dash. A declared charset outside that
family, or a `Content-Encoding` other than `identity`, is
refused with `415` — the status `body-parser` answers both with,
under `charset.unsupported` and `encoding.unsupported`. The
platform adapters inflate `gzip` and `deflate`; this one reads
the bytes as sent, so a client that compresses its payload
reaches them and not this adapter.

`app.useBodyParser('json', false, { limit: '1kb' })` accepts
`json`, `urlencoded`, `text` and `raw` parser names; any other
name is refused when the call is made. Parsing is selected by
the request's content type. The call sets one limit for the
adapter, so the size applies to every parser and every route,
and it replaces the `bodyLimit` option. The limit is the one
option it reads: any other — `inflate`, `verify`, `extended`,
`strict` — is refused by name when the call is made, rather than
accepted and dropped. Called without a `limit` it still enables
body parsing and applies the `rawBody` argument; only the
existing size limit is unchanged.

With `rawBody: true` — the adapter option, or the same option on
`NestFactory.create` — `NestRequest.rawBody` holds the bytes
read, which is what a signed webhook needs. Multipart bodies
never fill it, because the platform parser consumes the stream.

## Responses

A returned value is answered as Nest answers it: an object as
JSON, a string as text, a number as text. Raw bytes — `Buffer`,
`Uint8Array`, `ArrayBuffer`, a `ReadableStream` — are answered
as `application/octet-stream`, the type Fastify labels them
with, because serialising them as JSON is the one answer that
loses them. `@Header()`, `@HttpCode()`, `@Redirect()` and
`StreamableFile` are all honoured, and a declared `Content-Type`
always wins over the inferred one.

The `res.send()` row above is a different path: a module that
registers a route on the adapter itself is handed the Hono
context as an Express-shaped `res`, and that surface reads a
string the way Express does. See
[the Swagger section](features.md#what-the-adapter-provides).

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

## Instrumentation hooks

`setOnRequestHook()` and `setOnResponseHook()` are implemented
the way the platform adapters implement them, with one
difference the transports impose. The request hook is a
`(request, response, done)` function called at the start of a
request. It continues the chain by calling `done` or resolving a
returned promise or thenable, whichever happens first. A hook
that returns no thenable holds the request until it calls
`done`. A thrown error or rejection reaches the error layer.

The response hook is a `(request, response)` function called
once the chain has settled. Express runs its own from the
`finish` event of the Node response, and only the
`./node-server` transport has that event, so here it runs as
soon as the answer exists — before it has reached the client,
and whether the chain answered or failed. The answer is already
decided by then, so a failure the response hook raises is logged
rather than answered: letting it escape would replace a good
answer with the error one. The middleware waits up to one second
for the hook, so a pending promise cannot hold the response
indefinitely. Header changes must finish within that window. The
hook is not cancelled on timeout, and later rejections are still
logged.

Both are handed the same two objects the security hook Nest
registers is handed: the request Nest reads, and the Node
response where the transport carries one — the stand-in that
writes through the Hono context where it does not.

## What this adapter does not implement

Three platform APIs have no counterpart here. They are recorded
rather than emulated, because each one describes a framework
this adapter is not: an equivalent would be a different feature,
not a port, and a silent no-op would be worse than a named gap.

- **`useMultipart()`** is Fastify's explicit opt-in for
  `@fastify/multipart`. There is nothing to turn on here: a body
  is read on demand through Hono's `parseBody()`, and the upload
  interceptors behind `./multipart` are the supported path.
- **Part of the Express settings API** — `engine()` and `get()`.
  `setLocal()`, `set()`, `enable()` and `disable()` are
  implemented, and documented in
  [api.md](api.md#application-methods): a setting this adapter
  honours reaches behaviour, and a name with nothing behind it
  is refused with a reason rather than stored. `engine()` is a
  non-goal because it registers a template engine by file
  extension, which nothing here reads, and `setViewEngine()`
  already names the engine explicitly. `get()` is a non-goal by
  collision: Nest's `INestApplicationContext.get()` already
  answers the DI container with `any[]`, and the adapter already
  declares `get(target, handler)`, the GET route registrar, so
  Express's `app.get(setting)` cannot be added without a
  `TS2430` override error and a `TS4114` implicit-override
  error.
- **The Fastify route decorators** — `@RouteSchema()`,
  `@RouteConfig()` and `@RouteConstraints()`, which write the
  metadata keys `__fastify_route_schema__`,
  `__fastify_route_config__` and
  `__fastify_route_constraints__`. Only `FastifyAdapter` reads
  those keys, and nothing in the core's source does, so on this
  adapter the three are no-ops: they neither fail nor change a
  route. A Hono equivalent would be a new feature, not a port of
  these.

Two more are deliberately absent for a reason that is not
architectural, and each is documented where it belongs:
`FileStreamInterceptor` is recorded in
[parity.md](parity.md#file-uploads), because the streaming path
needs seams this adapter does not have, and a `./socket-io`
subpath is recorded in
[parity.md](parity.md#nestplatform-socketio--missing-entirely)
for the same reason on the fetch transport.

## What `inject()` does not carry

Fastify's `app.inject()` is implemented here, with four
differences a suite should read before it moves.

- **`raw` and `trailers` are absent, not empty.** The answer is
  a Web `Response` read through the Fetch API: there is no Node
  request and response object behind it to hand back, and no
  header block after the body. Everything else light-my-request
  reports is there: `statusCode`, `statusMessage`, `headers`,
  `rawPayload`, `payload`, `body`, `json()`, `stream()` and
  `cookies`, attributes included.
- **The builder and the callback form are not implemented.**
  `inject().get('/path').end()` and `inject(options, cb)` belong
  to light-my-request's `Chain`; the options object and the
  `'GET /path'` string are the two entry points here.
- **The application has to be initialized.** `inject()` answers
  from the routes Nest has registered, so a suite calls
  `await app.init()` (or `listen()`) first, as it does for the
  fetch transport. Fastify's helper starts the instance it is
  handed; this one has no application to start.
- **Four options are refused rather than ignored**, because each
  describes a socket this call never opens: `remoteAddress`,
  `authority`, `Request` and `payloadAsStream` throw naming
  themselves instead of answering something wrong. `simulate`,
  `validate`, `autoStart` and `server` describe how a socket is
  driven; they are accepted and change nothing.
