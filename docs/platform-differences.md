# Platform differences, routes, bodies and responses

How this adapter answers where Nest's own platform adapters
disagree, and how it reads Nest's path, query and body dialects.

## Where the platform adapters disagree

Where `platform-express` and `platform-fastify` disagree, this
adapter answers as `platform-fastify` does: the router scores
routes rather than matching in registration order, the response
is encapsulated with an escape hatch to the socket, a trailing
slash is significant, the body limit is 1 MiB, and there is no
`X-Powered-By` or `ETag` on the way out. Two defaults follow
**Express 4** instead: `@Query()` and URL-encoded bodies parse
with the `qs` grammar, and an empty JSON body reads as `{}`
(Express 5 reads the query flat; bracket syntax nests here, so
`filter[name]` is not a literal key).

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

Nest's path dialect is translated at startup:

| Nest              | Hono              |
| ----------------- | ----------------- |
| `/users/:id`      | `/users/:id`      |
| `/users/:id?`     | `/users/:id?`     |
| `/users{/:id}`    | `/users/:id?`     |
| `/users/:id(\d+)` | `/users/:id{\d+}` |
| `/files/*rest`    | `/files/*`        |

A path the router cannot read — `/users?`, a stray `}` or `(`, a
group holding more than one parameter — throws at startup rather
than answering 404 later. A wildcard is read back under `*`,
Fastify's key (a route's own name for it is not carried over),
so `@Get('files/*rest')` fills `req.params['*']`; `/files/%FF`
cannot be decoded and is a `400`. Middleware mounted for every
method (`app.use(fn)`, a `MiddlewareConsumer` without a method)
answers its path as a prefix, the way `use('/api')` answers
`/api` and everything under it; middleware for one named method
answers that path alone. Versioning works over URI, header,
media type and the custom strategy, including versioned
redirects; a media-type version is read out of `Accept` wherever
it sits, skipping `q` weights and earlier media ranges.

## Query strings

`@Query()` gets the platform parsers' shape: a repeated name
becomes a list, `tags[]` appends, `tags[0]` indexes and
`filter[name]` nests; values are percent-decoded, `+` reads as a
space, and `__proto__`, `constructor` and `prototype` are
dropped rather than written into the tree.

## Request bodies

The body is read when a handler reaches for it, not by
middleware:

- JSON, including the `+json` suffix types;
- URL-encoded and text bodies;
- `multipart/form-data` through Hono's `parseBody()`: fields
  land on `NestRequest.body`, files on `NestRequest.files`;
- every other content type as a `Buffer`.

With `@ailura/nestjs-platform-hono-multipart` imported, the
request path leaves multipart bodies for its interceptors, as
`@nestjs/platform-fastify` does; a multipart route without one
reads no `body` and no `files`. A body that does not match its
content type is refused with `BadRequestException`, and one over
`bodyLimit` with `PayloadTooLargeException`, so both travel
through the exception filters. A textual payload decodes with
its declared `charset` (`content-type`; `utf-8`, `utf-16le`,
`utf-16be`, with or without the dash); any other charset, or a
`Content-Encoding` other than `identity`, is refused with `415`
(`body-parser`'s status, `charset.unsupported`,
`encoding.unsupported`). The platform adapters inflate `gzip`
and `deflate`; this one reads the bytes as sent.

`app.useBodyParser('json', false, { limit: '1kb' })` accepts
`json`, `urlencoded`, `text` and `raw` names (others refused
when the call is made) and selects parsers by content type; it
sets one limit for every parser and route, replacing the
`bodyLimit` option. The limit is the one option it reads —
`inflate`, `verify`, `extended` and `strict` are refused by name
when the call is made. Called without a `limit` it still enables
parsing and applies the `rawBody` argument. With `rawBody: true`
(the adapter option or on `NestFactory.create`),
`NestRequest.rawBody` holds the bytes read for signed webhooks;
multipart bodies never fill it.

## Responses

A returned value is answered as Nest answers it: an object as
JSON, a string as text, a number as text. Raw bytes — `Buffer`,
`Uint8Array`, `ArrayBuffer`, `ReadableStream` — are
`application/octet-stream`, Fastify's type, because JSON would
lose them. `@Header()`, `@HttpCode()`, `@Redirect()` and
`StreamableFile` are honoured, and a declared `Content-Type`
wins over the inferred one. The `res.send()` row above is a
different path: a module route registered on the adapter itself
gets the Hono context as an Express-shaped `res`, which reads a
string the way Express does (see
[the Swagger section](features.md#what-the-adapter-provides)).
`@Res()` and `@Res({ passthrough: true })` work, with Hono's
helpers (`json`, `text`, `html`, `body`, `redirect`, `notFound`,
`newResponse`) as the imperative API, and a `Response` assigned
to `context.res` is sent too. `write`, `setHeader`, `getHeaders`
and the other Node stream members exist only once an `@Sse()`
route opens its stream.

## Instrumentation hooks

`setOnRequestHook()` / `setOnResponseHook()` are implemented,
with one difference the transports impose. The request hook,
`(request, response, done)`, runs at the start of a request and
continues the chain by calling `done` or resolving a returned
promise or thenable, whichever comes first; a hook returning no
thenable holds the request until it calls `done`, and a thrown
error or rejection reaches the error layer. The response hook,
`(request, response)`, runs once the chain settles. Express uses
the Node response's `finish` event, which only `./node-server`
has, so here it runs as soon as the answer exists — before it
reaches the client, and whether the chain answered or failed; a
failure it raises is logged rather than answered. The middleware
waits up to one second — header changes must finish within that
window; the hook is not cancelled on timeout, and later
rejections are still logged. Both get the request Nest reads and
the Node response or the stand-in that writes through the Hono
context.

## What this adapter does not implement

Three platform APIs have no counterpart here, recorded rather
than emulated because an equivalent would be a different
feature, not a port:

- **`useMultipart()`** — Fastify's `@fastify/multipart` opt-in;
  a body is read on demand through Hono's `parseBody()`, and the
  interceptors in `@ailura/nestjs-platform-hono-multipart` are
  the path.
- **Part of the Express settings API** — `engine()` and `get()`.
  `setLocal()`, `set()`, `enable()` and `disable()` are
  implemented and documented in
  [api.md](api.md#application-methods). `engine()` registers an
  engine by file extension, which nothing reads
  (`setViewEngine()` names it explicitly); `get()` collides with
  Nest's `INestApplicationContext.get()` (`any[]`) and the
  `get(target, handler)` GET route registrar, so
  `app.get(setting)` needs a `TS2430` override error and a
  `TS4114` implicit-override error.
- **The Fastify route decorators** — `@RouteSchema()`,
  `@RouteConfig()` and `@RouteConstraints()`, which write
  `__fastify_route_schema__`, `__fastify_route_config__` and
  `__fastify_route_constraints__`; only `FastifyAdapter` reads
  them, so here the three are no-ops.

`FileStreamInterceptor` and the
`@ailura/nestjs-platform-hono-socket-io` package are implemented
in those capability packages rather than here:
[file uploads](parity.md#file-uploads),
[socket.io](parity.md#nestjsplatform-socketio--implemented-in-ailuranestjs-platform-hono-socket-io).

## What `inject()` does not carry

Four differences from Fastify's `app.inject()`:

- **`raw` and `trailers` are absent, not empty** — the answer is
  a Web `Response` read through the Fetch API, with no Node
  objects or trailer block; `statusCode`, `statusMessage`,
  `headers`, `rawPayload`, `payload`, `body`, `json()`,
  `stream()` and `cookies` are all there.
- **No builder or callback form** —
  `inject().get('/path').end()` and `inject(options, cb)` are
  light-my-request's `Chain`; the options object and the
  `'GET /path'` string are the entry points.
- **The application must be initialized** — `inject()` answers
  from registered routes, so call `await app.init()` (or
  `listen()`) first, as with the fetch transport.
- **Four options are refused** — `remoteAddress`, `authority`,
  `Request` and `payloadAsStream` throw, each describing a
  socket this call never opens; `simulate`, `validate`,
  `autoStart` and `server` are accepted and change nothing.
