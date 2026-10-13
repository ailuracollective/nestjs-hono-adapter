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

### `enableCors()` — both signatures

Both are accepted: the fixed `CorsOptions`, and the
`CorsOptionsDelegate` Express takes, whose callback is handed
the request and answers the options that apply to it. A delegate
runs per request inside the CORS bridge, which is why it builds
the request a delegate reads — the same request bag a guard is
handed, built with `toNestRequest()`. `options.origin` keeps
working, and a delegate may combine the two.

### `useStaticAssets()` — both signatures

Express takes `(path, options)` and Fastify takes `(options)`
with the root inside it; both are read, so neither consumer has
to change the call. The first argument decides: a string or an
array of them names the directories, anything else is the
options object, and `root` inside it does the same. `prefix`,
`index`, `maxAge` and the rest keep their meaning in either
form. A call that names no directory at all is refused rather
than serving nothing. A `URL` root is not accepted, because
`FastifyStaticOptions['root']` allows one where the directories
here are filesystem paths.

### `setViewEngine()` — both signatures

Express's engine name and Fastify's options object
(`FastifyViewOptions`) are both read. From the object the
adapter takes `root` or `templates` as the directories,
`viewExt` as the extension, and `defaultContext` as data the
handler's own overrides. The `engine` it names has to be a
single engine — the function itself, or the `render` an engine
such as `ejs` or `pug` exposes — because this adapter compiles
from the template's source rather than from its path.
`includeViewExtension`, `maxCache` and `production` are accepted
and inert, since the adapter has no cache and always reads the
template it was named. Every other field Fastify defines
(`charset`, `layout`, `options`, `propertyName`,
`asyncProperyName`) is refused by name rather than ignored. The
engine the adapter was constructed with (`ViewOptions.engine`)
still works on its own.

### `setLocal()`, `set()`, `enable()`, `disable()` — implemented

Express reaches its application settings through
`NestExpressApplication`; here they are on the adapter and on
the application `NestFactory.create()` hands back.

`setLocal(key, value)` writes the context every render is merged
onto — the same one `ViewOptions.defaultContext` fills at
construction — so a local set after the application starts
reaches the next template, the way Express's `app.locals` does.

`set(name, value)` reaches the two settings that name behaviour
here: `view engine` delegates to `setViewEngine()` and `views`
to `setBaseViewsDir()`, while `enable(name)` and `disable(name)`
call it with `true` and `false`. Every other name is refused by
name with a reason rather than stored, so a setting nothing
reads fails where it is set. `trust proxy` points at the adapter
options, because the transport reads it when the adapter is
constructed, and `env`, `etag`, `query parser` and
`x-powered-by` have no behaviour to reach.

### `engine()` and `get()` — missing

`engine()` registers a template engine by file extension, and
nothing here reads that registry: `setViewEngine()` names the
engine explicitly instead.

`get()` is missing by collision rather than by choice. Nest's
`INestApplicationContext.get()` already answers the DI container
with `any[]`, and the adapter already declares
`get(target, handler)`, the GET route registrar, so Express's
`app.get(setting)` cannot be added without a `TS2430` override
error and a `TS4114` implicit-override error. Naming the
adapter's own `get` would shadow the container's, which is the
one Nest and every Nest consumer already call.

### `useMultipart()` — not applicable

Fastify's explicit opt-in for `@fastify/multipart`. Here a body
is read on demand through Hono's `parseBody()`, and the upload
interceptors (see [File uploads](#file-uploads)) are the
supported path, so there is nothing to turn on. It is recorded
as a non-goal in
[platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement).

### `inject()` — implemented

Fastify's light-my-request in-process testing helper, reached as
`app.inject()`. It is declared on the adapter and answers
through Hono's own `app.request()`, so a suite reaches its
routes without binding a port. Both call forms are read — the
options object and the `'GET /path'` string — along with
`url`/`path`, `method`, `headers`, `query`, `payload`/`body`,
`cookies` and `signal`. The answer carries `statusCode`,
`statusMessage`, `headers` (with `set-cookie` as a list),
`rawPayload`, `payload`, `body`, `json()`, `stream()` and
`cookies`. Four options - `remoteAddress`, `authority`,
`Request` and `payloadAsStream` — are refused by name rather
than ignored, and `raw` and `trailers` are absent rather than
faked, as
[platform-differences.md](platform-differences.md#what-inject-does-not-carry)
records.

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

### `create()` options — `path` only, the rest refused

`platform-ws` reads `server`, `path` and `namespace` out of the
options and hands everything else to its own `ws.Server`; it
refuses a namespace too, with the same advice to use
`@nestjs/platform-socket.io`. Only `path` can be honoured here.
A non-zero `port` would need a second HTTP listener; a `server`
would have to be driven by this adapter's transport; a namespace
has no counterpart; and the WebSocket server options cannot be
passed on, because the transport builds its support from the
Hono application alone
(`createWebSocket?: (app) => WebSocketSupport`). All of them are
refused by name rather than dropped, which is documented in
[docs/deployment.md](deployment.md#websockets).

### `forceCloseConnections` — not honoured

`AbstractWsAdapter` exposes it and `IoAdapter` reads it in
`close()`. `HonoWsAdapter.close()` always closes the sockets on
the path.

### `@Ack()` and namespaces — at parity with `platform-ws`

`WsAdapter` refuses a namespace and has no acknowledgement
callback either; the reply travels back as the echoed `id`.
These are only a gap against Socket.IO, and `./socket-io` closes
it without changing `./ws`.

### `@nestjs/platform-socket.io` — implemented, behind `./socket-io`

`HonoIoAdapter` is the counterpart of that package's
`IoAdapter`: `create()`, `createIOServer()`, `mapPayload()`,
`bindMessageHandlers()`, `bindClientDisconnect()` and `close()`,
so a gateway keeps its namespaces, its rooms, its broadcasts and
its acknowledgement callbacks. It is a new subpath beside
`./ws`, not a change to it.

It attaches to a Node `http.Server`, and only the Node transport
answers with one: `./node-server` runs on Node and on Bun, so a
Bun deployment that wants socket.io serves through it. The Bun
transport serves through `Bun.serve`, whose server carries `on`,
`listen` and `close` but never fires a Node request event, and
the fetch transport has no server at all; the adapter refuses
both by name instead of failing inside socket.io. That is the
one thing a consumer moving from Fastify has to change.

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

What was missing until this change is the streaming interceptor
`@nestjs/platform-fastify/multipart` publishes:
`FileStreamInterceptor`, and the `processStream` behind it. The
`MultipartFileStream` type was exported with nothing to produce
it, and the review had it removed rather than left dead; the
interceptor produces it now.

The exemption the island carried is narrower now: one block over
`src/multipart/**` that turned off around 35 rules became ten
blocks over thirteen files, and the nine files that need none of
those rules carry them again. The cases the suite was missing —
`fileFilter`, `registerAsync`, a malformed boundary and a
`__proto__` field name — are covered, and each was proven by
mutation, so it fails when the behaviour it pins is removed.

The streaming interceptor is implemented, and the three seams
the reconnaissance found are closed by one design. Upstream
`processStream` walks `req.parts()` and returns on the first
file of the field it was asked for, leaving the iterator
suspended so the handler reads a live stream; the interceptor
then drains the rest, either before answering or from
`reply.raw`'s `close` when the handler answers with a
`StreamableFile`.

Here `processStream()` sits beside `processMultipart()` in the
island's parser and feeds busboy from the Web body, so the first
seam closes on the fact that busboy emits a file part while it
is still parsing: the handler is handed busboy's own stream
rather than a stored file. The take is marked synchronously,
before anything awaits, so the parts that follow the one being
taken are read and not parsed — the contract upstream documents.
A file in any other field is a `400`, as upstream answers one.

The second seam is answered differently rather than solved.
`context.req.raw` is a Web `Request` and there is no socket
`close` to hang the drain on, so an answer that is a
`StreamableFile` is drained before it goes out — unless it is
built from the very stream the handler was handed, which
`StreamableFile.getStream()` makes checkable and which the
response drains itself as it is written. Upstream defers that
drain to the socket and warns that answering with an unrelated
`StreamableFile` before the upload is read fails on a connection
that is not kept alive; draining first is stricter, never later.

The third seam is why the discard reads rather than cancels:
cancelling `request.raw.body` reaches the client as an aborted
request, so the drain unpipes busboy, resumes the source and
reads the rest into nothing, which is `raw.resume()` by another
name. A client that aborts mid-upload has its error carried onto
the stream the handler is reading, so the read fails rather than
hangs.

The ceiling decision the reconnaissance left open was taken, as
the first item of the backlog asked: `./multipart` moved from
3800 B to 4250 B for 553 B of measured growth, recorded in
[bundle-baseline.md](bundle-baseline.md) and justified in
[architecture.md](architecture.md#the-bundle-budget).

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
different feature rather than a port. They are recorded as
unsupported in
[platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement)
rather than emulated.

## Backlog

Ordered by what it costs and what it unblocks.

The one item this list carried — whether to support Socket.IO —
is settled: it is `./socket-io`, a subpath of its own, and the
section above records what it covers and the one transport it
needs. Nothing else the reconnaissance found is outstanding.

The non-goals and the runtime surface are written down:
[docs/platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement)
records `useMultipart()`, the Express settings API and the
Fastify route decorators, and
[docs/architecture.md](architecture.md#the-runtime-surface)
records which layer reaches which builtin.
