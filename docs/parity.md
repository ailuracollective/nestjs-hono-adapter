# Parity with Nest's platform adapters

What this package implements of the surface
`@nestjs/platform-express`, `@nestjs/platform-fastify`,
`@nestjs/platform-socket.io` and `@nestjs/platform-ws` publish,
what it leaves out, and what is still to be built.

A row marked **missing** is work nobody has done; **not
applicable** is a feature Hono has no equivalent for and this
package does not intend to carry; **in progress** written but
not merged.

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

Three members are inherited and unchanged: `setCookie()` /
`clearCookie()` (written on `appendHeader()`) and
`setOnRouteTriggered()` / `getOnRouteTriggered()` (read and
invoked by the core). `registerSecurityHook()` is an own
property in `packages/core/src/core/server/server-adapter.ts`;
`NestHonoApplication`
(`packages/core/src/core/server/application.ts`) is the
counterpart of `NestExpressApplication` and
`NestFastifyApplication`.

On the WebSocket side `create()`, `bindMessageHandlers()`,
`bindClientDisconnect()`, `close()` and `dispose()` are
implemented, and `bindClientConnect()` is inherited.

## HTTP adapter

### `mapException()` — implemented

Nest hands it every error before the filters. It mirrors
Express: `SyntaxError` or `URIError` → `BadRequestException`,
`FastifyError` → `HttpException`, anything else unchanged. A
wildcard is percent-decoded when the params are read
(`paramsOf`, `packages/core/src/core/request/params.ts`), so
`/files/%FF` is a `400` where it used to be a `500`;
`createRouteHandler` reads the params before handing the request
over, so the mapping answers it. Query values decode themselves
and keep the raw text on failure
(`packages/core/src/core/request/query/index.ts`), so they never
raise it.

### `setOnRequestHook()` / `setOnResponseHook()` — implemented

The request hook, `(request, response, done)`, runs at the start
of a request and continues the chain by calling `done` (Express
`next`, Fastify `done`) or resolving a returned thenable; a
failure either way reaches the error layer. The response hook,
`(request, response)`, runs once the chain settles, answered or
failed: Express uses the `finish` event (absent on the Bun and
fetch transports), so a failure it raises is logged, not
answered. Both get the request Nest reads, built by
`toNestRequest()`, and the Node response or the stand-in that
writes through the Hono context.
`packages/core/src/features/front-steps/index.ts` builds the
step that runs both ahead of every route.

### `enableCors()` — both signatures

`CorsOptions` and Express's `CorsOptionsDelegate` are both
accepted. A delegate runs per request inside the CORS bridge,
which builds the request it reads with `toNestRequest()` (the
same bag a guard is handed); `options.origin` still works and a
delegate may combine the two.

### `useStaticAssets()` — both signatures

Express's `(path, options)` and Fastify's `(options)` are both
read: a string or array first argument names the directories,
anything else is the options object, and `root` inside it does
the same. `prefix`, `index` and `maxAge` keep their meaning; a
call naming no directory is refused; a `URL` root is not
accepted, since `FastifyStaticOptions['root']` allows one where
these are filesystem paths.

### `setViewEngine()` — both signatures

Express's engine name and Fastify's `FastifyViewOptions` are
both read: from the object, `root` or `templates` are the
directories, `viewExt` the extension, `defaultContext` handler
overrides. `engine` must be a single engine (the function, or
`ejs`/`pug`'s `render`) because compilation is from the
template's source. `includeViewExtension`, `maxCache` and
`production` are inert; every other field Fastify defines
(`charset`, `layout`, `options`, `propertyName`,
`asyncProperyName`) is refused by name. `ViewOptions.engine`
still works alone.

### `setLocal()`, `set()`, `enable()`, `disable()` — implemented

Settings live on the adapter and on the application
`NestFactory.create()` returns. `setLocal(key, value)` keeps
locals separate from the `defaultContext`; a render merges
defaults, locals and handler data in that order, and
`__proto__`-like keys are own data properties.
`set(name, value)` handles `view engine` (→ `setViewEngine()`)
and `views` (→ `setBaseViewsDir()`; string or string array,
searched in order); `enable(name)` / `disable(name)` call it
with `true` / `false`; every other name is refused with a
reason. `trust proxy` reads the adapter options; `env`, `etag`,
`query parser` and `x-powered-by` have no behaviour.

### `engine()` and `get()` — missing

`engine()` registers a template engine by extension and nothing
here reads that registry. `get()` collides: Nest's
`INestApplicationContext.get()` answers the DI container with
`any[]`, and the adapter declares `get(target, handler)`, the
GET route registrar, so `app.get(setting)` cannot be added
without a `TS2430` override error and a `TS4114`
implicit-override error.

### `useMultipart()` — not applicable

Fastify's `@fastify/multipart` opt-in; a body is read on demand
through Hono's `parseBody()`, and the upload interceptors (see
[File uploads](#file-uploads)) are the path. Recorded as a
non-goal in
[platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement).

### `inject()` — implemented

Fastify's light-my-request helper, `app.inject()`, declared on
the adapter and answered through Hono's `app.request()`. Both
call forms (options object, `'GET /path'`) are read with
`url`/`path`, `method`, `headers`, `query`, `payload`/`body`,
`cookies` and `signal`; the answer carries `statusCode`,
`statusMessage`, `headers` (`set-cookie` as a list),
`rawPayload`, `payload`, `body`, `json()`, `stream()` and
`cookies`. Four options — `remoteAddress`, `authority`,
`Request`, `payloadAsStream` — are refused by name, and `raw`
and `trailers` are absent rather than faked, as
[platform-differences.md](platform-differences.md#what-inject-does-not-carry)
records.

### `listen()` — the object form is not accepted

Only the positional forms — `(port)`, `(port, hostname)`,
`(port, callback)`, `(port, hostname, callback)` — the shapes
`NestApplication.listen()` uses; Fastify's `{ port, host }`
object is not read. Every transport builds the `Server` port
(`packages/core/src/core/ports/server.ts`) with
`listen(port, hostname?, callback?)` and nothing else:
`./bun-server` binds through `Bun.serve` and `./fetch` has no
listening server, so a bind-options bag has nowhere to go.

## WebSocket adapter

Against `@nestjs/platform-ws`:

### `setMessageParser()` — implemented

`HonoWsAdapter` takes Nest 12 `WsAdapter`'s `messageParser`
constructor option and `setMessageParser()` method, reading
every frame with the parser in use (`parseFrame()` in
`packages/ws/src/client/frames.ts` is the built-in). A throwing
parser is an application bug and is reported; the built-in reads
client input, so its failures stay quiet. Either way the frame
is dropped, as on `platform-ws`.

### `bindErrorHandler()` — implemented

`HonoWsAdapter.bindErrorHandler()` attaches an error listener to
the `GatewayServer` and every socket it hands over (as
`WsAdapter.bindErrorHandler(server)` does on `platform-ws`), so
a failure is logged rather than thrown out of the event loop;
`create()` calls it for every path.

### `create()` options — `path` only, the rest refused

Only `path` is honoured. `server`, `namespace` and the WebSocket
server options are refused by name (on `platform-ws` the rest is
handed to its own `ws.Server`; a namespace gets the advice to
use `@nestjs/platform-socket.io`), because the transport builds
its support from the Hono application alone
(`createWebSocket?: (app) => WebSocketSupport`); a non-zero
`port` needs a second listener and a `server` would have to be
driven by the transport. Documented in
[docs/deployment.md](deployment.md#websockets).

### `forceCloseConnections` — not honoured

`AbstractWsAdapter` exposes it and `IoAdapter` reads it;
`HonoWsAdapter.close()` always closes the sockets on the path.

### `@Ack()` and namespaces — at parity with `platform-ws`

`WsAdapter` refuses a namespace and has no acknowledgement
callback; the reply travels back as the echoed `id`. This is a
gap only against Socket.IO, closed by
`@ailura/nestjs-platform-hono-socket-io` without changing
`@ailura/nestjs-platform-hono-ws`.

### `@nestjs/platform-socket.io` — implemented, in `@ailura/nestjs-platform-hono-socket-io`

`HonoIoAdapter` is the counterpart of `IoAdapter` — `create()`,
`createIOServer()`, `mapPayload()`, `bindMessageHandlers()`,
`bindClientDisconnect()` and `close()` — so a gateway keeps its
namespaces, rooms, broadcasts and acknowledgement callbacks. It
attaches to a Node `http.Server`, which the Node transport
provides on Node and Bun; where the transport serves through
`Bun.serve`, it binds a socket.io engine to that server instead
when the optional `@socket.io/bun-engine` peer is installed. A
fetch host — and a `Bun.serve` deployment without that peer — is
refused by name instead of failing inside socket.io.

## File uploads

`@nestjs/platform-express/multer` and
`@nestjs/platform-fastify/multipart` publish `MulterModule`,
`FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor`,
`AnyFilesInterceptor`, `NoFilesInterceptor`, the `diskStorage` /
`memoryStorage` engines, and the streaming
`FileStreamInterceptor` with its `processStream`.

`@ailura/nestjs-platform-hono-multipart`
(`packages/multipart/src/**`) implements that shape —
interceptors, module, both storage engines, interfaces,
`packages/multipart/test/multipart.test.ts` — producing the
`MultipartFileStream` type, with `busboy` an optional peer of
the adapter and a required one of this package, and its own
ceiling in `packages/multipart/.size-limit.json`. An aborted
upload cancels the parse, a non-adapter is refused, and an
`undefined` file-filter or name-resolver error counts as
failure.

`processStream()` sits beside `processMultipart()` in the
island's parser and feeds busboy from the Web body: the handler
gets busboy's own stream, the take is marked synchronously so
later parts are read but not parsed, and a file in any other
field is a `400` — upstream's contract (upstream walks
`req.parts()` and returns on the first file, leaving the
iterator suspended). `context.req.raw` has no socket `close` to
hang a drain on, so an answer that is a `StreamableFile` is
drained before it goes out unless it is built from the stream
the handler was handed (`StreamableFile.getStream()` makes that
checkable); upstream defers that drain to `reply.raw`'s `close`
instead. The discard reads rather than cancels (cancelling
`request.raw.body` aborts the client), so an abort mid-upload
surfaces as a read failure, not a hang.

The multipart entry moved from 3800 B to 4250 B for 553 B of
measured growth, recorded in
[bundle-baseline.md](bundle-baseline.md) and justified in
[architecture.md](architecture.md#the-bundle-budget).

## Fastify route decorators

`@nestjs/platform-fastify/decorators` publishes
`@RouteSchema()`, `@RouteConfig()` and `@RouteConstraints()`,
writing `__fastify_route_schema__`, `__fastify_route_config__`
and `__fastify_route_constraints__`. Only `FastifyAdapter` reads
those keys, so on this adapter the three are no-ops; a Hono
equivalent would be a new feature, not a port. Recorded as
unsupported in
[platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement).

## Backlog

The list's one item — Socket.IO support — is settled as
`@ailura/nestjs-platform-hono-socket-io`, recorded above;
nothing else the reconnaissance found is outstanding. The
non-goals are recorded in
[docs/platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement)
(`useMultipart()`, the Express settings API, the Fastify route
decorators), and the runtime surface in
[docs/architecture.md](architecture.md#the-runtime-surface).
