# Parity with Nest's platform adapters

What this package implements of the surface
`@nestjs/platform-express`, `@nestjs/platform-fastify`,
`@nestjs/platform-socket.io` and `@nestjs/platform-ws` publish,
what it leaves out, and what is still to be built.

A row marked **missing** is work nobody has done; one marked
**not applicable** is a framework-native feature Hono has no
equivalent for and that this package does not intend to carry;
one marked **in progress** is written but not merged.

## Contents

- [What is already at parity](#what-is-already-at-parity)
- [HTTP adapter](#http-adapter)
- [WebSocket adapter](#websocket-adapter)
- [File uploads](#file-uploads)
- [Fastify route decorators](#fastify-route-decorators)
- [Backlog](#backlog)

## What is already at parity

Every abstract member of Nest's `AbstractHttpAdapter` is
implemented: the verbs, `use()`, `createMiddlewareFactory()`,
`applyVersionFilter()`, `status()`, `reply()`, `end()`,
`render()`, `redirect()`, the header accessors and
`isHeadersSent()`, `setErrorHandler()`, `setNotFoundHandler()`,
`registerParserMiddleware()`, `useBodyParser()`, `enableCors()`,
`getRequestHostname()`, `getRequestMethod()`, `getRequestUrl()`,
`useStaticAssets()`, `setViewEngine()`, `getType()`,
`isRouteOrderSensitive()`, `listen()`, `close()` and
`initHttpServer()`.

Three members are inherited from the base class and work here
unchanged: `setCookie()` and `clearCookie()`, which are written
on top of `appendHeader()`, and the `setOnRouteTriggered()` /
`getOnRouteTriggered()` pair, which the core reads and invokes
itself. `registerSecurityHook()` is installed as an own property
in `src/core/server-adapter.ts`, and `NestHonoApplication`
(`src/core/application.ts`) is the counterpart of
`NestExpressApplication` and `NestFastifyApplication`.

On the WebSocket side `create()`, `bindMessageHandlers()`,
`bindClientDisconnect()`, `close()` and `dispose()` are
implemented, and `bindClientConnect()` is inherited.

## HTTP adapter

### `mapException()` — implemented

Nest hands `mapException()` every error the error layer
receives, before the filters see it. Express maps a
`SyntaxError` or a `URIError` to a `BadRequestException` and
Fastify maps its own `FastifyError` to an `HttpException`; this
adapter mirrors Express, and returns anything else unchanged.

The `URIError` is the one that carries. A wildcard is
percent-decoded when the params are read (`paramsOf` in
`src/core/params.ts`), so a path whose escape stands for no
character — `/files/%FF` — is a `400` where it used to be a
`500`. Query values decode themselves and keep the raw text when
that fails (`src/core/query.ts`), so they never raise it.

Where the decode fails matters as much as the mapping. Nest
wraps every route handler in a proxy that answers a failure
itself, so an error raised inside it never reaches the error
layer; `createRouteHandler` reads the params before it hands the
request over, which is what puts this failure where the mapping
can answer it.

### `setOnRequestHook()` / `setOnResponseHook()` — implemented

Both platform adapters implement them, and instrumentation and
devtools call them. Nothing in Nest calls them itself, so an
adapter that does not run them is an adapter where a registered
hook never runs. `src/features/guard-bridge.ts` builds the step
that runs both, mounted in front of every route.

The request hook is a `(request, response, done)` function
called at the start of a request. It continues the chain by
calling `done`, as it does on Express (`next`) and Fastify
(`done`); one that answers the promise it returns instead is
waited for just the same, and a failure either way reaches the
error layer.

The response hook is a `(request, response)` function called
once the chain has settled, whether it answered or failed.
Express runs it from the `finish` event, which the Bun and fetch
transports do not have; the answer already exists by the time it
runs, so a failure it raises is logged rather than answered.

Both are handed the two objects the security hook Nest registers
is handed: the request Nest reads, built by `toNestRequest()`,
and the Node response where the transport carries one — the
stand-in that writes through the Hono context where it does not.

### `enableCors()` — narrower than both

Express accepts `CorsOptions | CorsOptionsDelegate` and Fastify
accepts a function, so an origin can be decided per request.
`src/features/cors-middleware.ts` takes `CorsOptions` alone.

### `useStaticAssets()` — Express signature only

Express takes `(path, options)`, Fastify takes `(options)` with
the root inside it. `src/features/static-assets.ts` implements
the first, so a consumer arriving from Fastify has to change the
call.

### `setViewEngine()` — string only

Fastify also accepts an options object (`FastifyViewOptions`)
and Express a string. Only the string form is implemented; the
engine itself is configured through the `views` adapter option
(`ViewOptions`).

### `setLocal()`, `set()`, `enable()`, `disable()`, `engine()` — missing

These are Express application settings reached through
`NestExpressApplication`, and they have no Hono counterpart.
`setBaseViewsDir()` and `setViewEngine()` are implemented
directly, so views work; the generic settings API does not
exist.

### `useMultipart()` — not applicable

Fastify's explicit opt-in for `@fastify/multipart`. Here a body
is read on demand through Hono's `parseBody()`, and the upload
interceptors (see [File uploads](#file-uploads)) are the
supported path, so there is nothing to turn on.

### `inject()` — missing

Fastify's light-my-request in-process testing helper, reached as
`app.inject()`. A test suite that used it has no equivalent
here, although Hono's own `app.request()` could back one.

## WebSocket adapter

Against `@nestjs/platform-ws`:

### `setMessageParser()` — implemented

Nest 12's `WsAdapter` accepts a `messageParser` in its
constructor and exposes `setMessageParser()` for a deployment
whose frames are not JSON. `HonoWsAdapter` takes the same option
and exposes the same method, and reads every frame with the
parser in use; `parseFrame()` in `src/ws/client.ts` is the
built-in one.

A parser that throws is an application bug and is reported. The
built-in one reads client-controlled input, so its failures stay
quiet: reporting those would turn a public socket into a log
flood target. Either way the frame is dropped, as it is on
`platform-ws`.

### `bindErrorHandler()` — implemented

`WsAdapter.bindErrorHandler(server)` attaches an error listener
to the server and to every socket it hands over, so a failure is
logged rather than thrown: an `EventEmitter` that raises `error`
with no listener throws it out of the event loop.
`HonoWsAdapter.bindErrorHandler()` attaches the same pair to a
`GatewayServer` and answers it, and `create()` calls it for
every path.

### `create()` options — partially honoured

`WsAdapter` passes the server options through (`noServer`,
`perMessageDeflate`, `maxPayload`, and so on) and accepts a
`server` to attach to. Only `path` is read here; a non-zero
`port` and a `namespace` are refused rather than dropped, which
is documented in [docs/deployment.md](deployment.md#websockets).

### `forceCloseConnections` — not honoured

`AbstractWsAdapter` exposes it and `IoAdapter` reads it in
`close()`. `HonoWsAdapter.close()` always closes the sockets on
the path.

### `@Ack()` and namespaces — at parity with `platform-ws`

`WsAdapter` refuses a namespace and has no acknowledgement
callback either; the reply travels back as the echoed `id`.
These are only a gap against Socket.IO.

### `@nestjs/platform-socket.io` — missing entirely

No `IoAdapter`, no `createIOServer()`, no `mapPayload()`, and
therefore no namespaces, no rooms, no broadcasting and no
acknowledgement callbacks. A consumer that used
`@nestjs/platform-socket.io` cannot move to this adapter.

It is feasible on the Node and Bun transports, where
`getHttpServer()` answers a real `http.Server` for `socket.io`
to attach to; it is not feasible on the `fetchServer()`
transport, where there is no socket. It would be a new subpath
beside `./ws`, not a change to it.

## File uploads

`@nestjs/platform-express/multer` publishes `MulterModule`,
`FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor`,
`AnyFilesInterceptor`, `NoFilesInterceptor` and the
`diskStorage` / `memoryStorage` engines;
`@nestjs/platform-fastify/multipart` publishes the same shape.

That work is merged: a `./multipart` subpath
(`src/multipart/**`) with the interceptors, the module, the two
storage engines, the interfaces and `test/multipart.test.ts`,
with `busboy` as an optional peer and a ceiling of its own in
`.size-limit.json`.

A review before the merge closed three things. An aborted upload
now cancels the parse instead of leaving an unhandled error on
the source stream and a request that never settles. An adapter
that is not this one is refused, as the Fastify island refuses
an adapter it was not written for. And an `undefined` error from
a file filter or a name resolver counts as a failure, where disk
storage used to store nothing and still report success.

What is still missing is the streaming interceptor
`@nestjs/platform-fastify/multipart` publishes:
`FileStreamInterceptor`, and the `processStream` behind it. The
`MultipartFileStream` type was exported with nothing to produce
it, and the review had it removed rather than left dead.

The exemption the island carried is narrower now: one block over
`src/multipart/**` that turned off around 35 rules became ten
blocks over thirteen files, and the nine files that need none of
those rules carry them again. The cases the suite was missing —
`fileFilter`, `registerAsync`, a malformed boundary and a
`__proto__` field name — are covered, and each was proven by
mutation, so it fails when the behaviour it pins is removed.

The streaming interceptor stays unimplemented, and the reason is
not only the deadlock the first attempt ran into. Upstream
`processStream` walks `req.parts()` and returns on the first
file of the field it was asked for, leaving the iterator
suspended so the handler reads a live stream; the interceptor
then drains the rest, either before answering or from
`reply.raw`'s `close` when the handler answers with a
`StreamableFile`. Three seams are missing here. The parser
consumes the whole body before `next.handle()`, so there is no
live stream to hand over. The adapter is fetch-backed, so
`context.req.raw` is a Web `Request` and the only post-response
hook runs before the `Response` reaches Hono, not when the
socket closes. And discarding a Web body is not the safe
`raw.resume()`: cancelling `request.raw.body` reads to the
client as an aborted request, which is the race upstream drains
to avoid. The ceiling settles it — `./multipart` sits at 3.64 kB
of 3.8 kB, and the three pieces cost several hundred bytes
minified, so this is a ceiling decision rather than a port.

## Fastify route decorators

`@nestjs/platform-fastify/decorators` publishes
`@RouteSchema()`, `@RouteConfig()` and `@RouteConstraints()`,
which write the metadata keys `__fastify_route_schema__`,
`__fastify_route_config__` and `__fastify_route_constraints__`.
Only `FastifyAdapter` reads them, in its route registration;
nothing in `src/` does, so on this adapter the three decorators
are no-ops.

They describe Fastify's own route options — a JSON schema, a
route config, a constraint — and a Hono equivalent would be a
different feature rather than a port. The recommendation is to
document them as unsupported rather than to emulate them.

## Backlog

Ordered by what it costs and what it unblocks.

1. **The upload island's streaming interceptor.** The island's
   last leftover: `FileStreamInterceptor` and the
   `processStream` behind it. The reconnaissance recorded above
   finds it blocked on three seams that do not exist here, and
   on the `./multipart` ceiling, so it needs a deliberate
   decision about that ceiling before it can be written.
2. **Signature breadth.** The CORS delegate, the Fastify form of
   `useStaticAssets()`, the object form of `setViewEngine()`,
   and the server options `create()` currently drops.
3. **`inject()`.** An in-process request helper for tests, on
   top of Hono's `app.request()`.
4. **Decide on Socket.IO.** Either a `./socket-io` subpath for
   the Node and Bun transports, or a written non-goal.
5. **Write down the non-goals.** `useMultipart()`, the Express
   settings API and the Fastify route decorators, in
   [docs/platform-differences.md](platform-differences.md) or
   here.
6. **Settle one loose sentence.** `docs/architecture.md` says a
   transport's modules are the only ones that reach the builtins
   a runtime owns; `features/views` and `features/static-assets`
   reach `node:fs/promises` too, and the upload island's disk
   storage reaches four of them.
