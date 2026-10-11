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

### `setOnRequestHook()` / `setOnResponseHook()` — missing

Both platform adapters implement them, and instrumentation and
devtools call them. They are inert here, so a hook registered
through either never runs. The hook is a
`(request, response, next)` function called at the start of a
request, and a `(request, response)` function called once the
response is sent.

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

### `setMessageParser()` — missing

Nest 12's `WsAdapter` accepts a `messageParser` in its
constructor and exposes `setMessageParser()` for a deployment
whose frames are not JSON. The frame parser here is fixed
(`parseFrame()` in `src/ws/client.ts`), so a custom format
cannot be plugged in.

### `bindErrorHandler()` — missing

`WsAdapter` attaches an error listener to the server and to
every socket, so a socket failure is logged. `GatewayServer`
(`src/ws/server.ts`) is an `EventEmitter` with no `error`
handling, and an `'error'` event with no listener throws.

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

1. **The instrumentation hooks.** `setOnRequestHook()` and
   `setOnResponseHook()` as Hono middleware, honouring the
   `(request, response, next)` contract.
2. **The WebSocket parser and error handling.** `messageParser`
   in the constructor and in `setMessageParser()`, and an error
   listener on the gateway server.
3. **The upload island's leftovers.** The streaming interceptor
   above; the `.oxlintrc.json` block that disables around 35
   rules for the whole `src/multipart/**` region, where a
   per-file scope would be narrower; and the `fileFilter`,
   `registerAsync`, malformed-boundary and `__proto__` cases
   `test/multipart.test.ts` does not yet cover.
4. **Signature breadth.** The CORS delegate, the Fastify form of
   `useStaticAssets()`, the object form of `setViewEngine()`,
   and the server options `create()` currently drops.
5. **`inject()`.** An in-process request helper for tests, on
   top of Hono's `app.request()`.
6. **Decide on Socket.IO.** Either a `./socket-io` subpath for
   the Node and Bun transports, or a written non-goal.
7. **Write down the non-goals.** `useMultipart()`, the Express
   settings API and the Fastify route decorators, in
   [docs/platform-differences.md](platform-differences.md) or
   here.
8. **Settle one loose sentence.** `docs/architecture.md` says a
   transport's modules are the only ones that reach the builtins
   a runtime owns; `features/views` and `features/static-assets`
   reach `node:fs/promises` too, and the upload island's disk
   storage reaches four of them.
