# Architecture

This is the map a contributor needs before changing a file. The
README describes what the adapter does; this describes the shape
it is built in, and which shapes are refused.

## The regions of `src/`

```
src/
  index.ts  ws/index.ts  multipart/index.ts    the entrypoints
  servers/bun.ts  servers/node.ts  servers/fetch.ts   the runtime transports
  ws/adapter.ts  ws/client.ts  ws/server.ts   the WebSocket island
  multipart/  the upload island
  core/     the Nest <-> Hono translation and the ports
  features/ the optional capabilities
```

**`core/`** holds the translation and the adapter chain, the
ports that describe a runtime, and the primitives translation
needs. It is the only region that knows both Nest's contract and
Hono's objects — and it names no runtime.

**`features/`** holds the capabilities a deployment may or may
not turn on: CORS, event streams, static assets, views. They are
separate because each one is optional at runtime, and because
none of them should be able to reach sideways into another.

**The transports** are the runtime-specific halves,
`servers/bun.ts`, `servers/node.ts` and `servers/fetch.ts`. Each
is reached only through its own subpath, and each reaches
`core/` for the ports it implements. A deployment loads one and
no other. The fetch transport is the one for a host that serves
a Web `Request` and expects a Web `Response` — Cloudflare
Workers, Vercel Functions, Deno — where nothing listens.

**The WebSocket island** is separate from all of them. It is
neutral: it asks the adapter for its transport rather than
importing a runtime's own WebSocket module.

**The upload island** (`multipart/`) is the second opt-in
island, behind `./multipart`. It is the only place that consumes
a `multipart/form-data` body and the only place that depends on
a parser (`busboy`, an optional peer). Its interceptors parse
the body the way multer does, so `@UploadedFile()` and
`@UploadedFiles()` work; importing it marks the adapter through
`core/multipart.ts`, and a marked adapter leaves a multipart
body alone for an interceptor to consume. An adapter that serves
no upload carries no trace of it.

## The dependency rules

Four rules, all enforced by `test/layers.test.ts`:

1. `core/` never reaches `features/`, **except** from
   `core/hono-lifecycle.ts` and `core/server-adapter.ts`.
2. `features/` never reaches `features/`.
3. `features/` never reaches the WebSocket island.
4. The islands reach `core/` and `features/` **only through
   type-only imports**. The upload island has one value edge,
   `core/multipart.ts`, the marker it sets on the adapter.
5. The socket.io island reaches `core/` and `features/` not at
   all, as a value or as a type.

Rule 1 has exactly two exceptions because exactly two modules
are the composition root: they are the ones that turn a
capability into a running adapter. Everything else in `core/` is
reached only by Nest's contract.

Rule 4 is the load-bearing one. `src/ws/adapter.ts` does import
`ServerAdapter`, and it does so with `import type`. That is
erased at compile time, so the `/ws` subpath never loads the
HTTP adapter. The moment that becomes a value import, a
deployment that only serves HTTP pays for a WebSocket stack.

The upload island follows the same rule with one exception it
can name: `multipart/multipart/multipart.interceptor.factory.ts`
imports `declareMultipart` from `core/multipart.ts` as a value,
because marking the adapter is the whole point of the island.
Its other reaches into `core/` are types, so a deployment that
serves no upload loads neither the island nor its parser.

The socket.io island goes one step further, which is why it has
a rule of its own: it names nothing in `core/` or `features/` at
all. Nest hands the adapter the server it already built, so
`packages/socket-io/src/io-adapter.ts` needs no port and no
composition root — its runtime graph is `socket.io` and the
three modules behind `./socket-io`, and `test/layers.test.ts`
refuses both the value edge and the type edge that would change
that. The island is the first capability to move out of `src/`:
it lives in the `packages/socket-io` workspace package, and
`src/socket-io/index.ts` re-exports it so the `./socket-io`
subpath a deployment already imports keeps resolving.

One more split is a packaging rule rather than a layer one:
`core/` never imports `servers/bun.ts` or `servers/fetch.ts`; a
transport imports the ports it implements. There is one
exception, taken deliberately and held by
`test/entry-points.test.ts`: `core/server-adapter.ts` — the
composition root the layer rules already name — imports
`servers/node.ts`, to hand the adapter the transport it serves
through when a deployment names none. That is what keeps
`new ServerAdapter()`, the bootstrap this package published
with, working unchanged; the cost is that `.` requires
`@hono/node-server`, which it always did.

`src/core/application.ts` is the one module whose entire
contents are types: the interface a bootstrap hands to
`NestFactory.create()`, and the member this package declares on
Nest's `HttpServer` so `getHono()` is reachable out of
`getHttpAdapter()`. Every import it declares is `import type`,
so it costs the bundle nothing and the bundler never reaches it
— a claim `test/types/application-surface.ts` holds at compile
time rather than leaving to review.

## Entrypoints and isolation

The `exports` map in `package.json` exposes seven specifiers:
`.`, `./bun-server`, `./node-server`, `./fetch`, `./multipart`,
`./ws` and `./socket-io`. `./ws` is emitted from `packages/ws`,
the WebSocket adapter's own package, so the subpath survives
without the core depending on that package. It exposes nothing
else, so no consumer can reach an internal module by path —
which is what makes it safe to move files between regions
without it being a breaking change.

`test/entry-points.test.ts` walks the import graph transitively
from the neutral entrypoints. It fails if `.` reaches
`@hono/node-ws` or `@nestjs/websockets`, the optional peer
dependencies: a deployment that serves HTTP must not need either
installed. It checks the opposite direction too, because
`@hono/node-server` is required and reached on purpose: `.`
serves through it when no transport is named, which is the
behaviour every deployment had before the transports split.
`./ws` is the only entrypoint that reaches the WebSocket peers,
`./socket-io` the only one that reaches `socket.io`, and
`./multipart` the only one that reaches `busboy`. The WebSocket
adapter is checked where it now lives: `test/layers.test.ts`
walks `packages/ws/src` as the `ws` layer and
`test/entry-points.test.ts` asks for its peers at the package.

Note the deliberate difference between the two guards.
`entry-points.test.ts` counts a type-only import as an edge;
`layers.test.ts` distinguishes them. That is on purpose. The
entrypoint guard wants to be conservative — if a type import
ever becomes a value import, it should catch it early. The layer
guard has to be precise, because rule 4 is exactly about that
difference.

## The compatibility face

Names that carry the shape the package published before the
transports split, so a deployment that never names a transport
keeps compiling and keeps working:

- `getHttpServer()` is `Server & http.Server`, and the default
  transport hands back Node's own server with `listen` and
  `close` adapted in place: `closeAllConnections()` and an
  `'upgrade'` listener are still there.
- `NestRequest.raw` is `IncomingMessage & Incoming`, and
  `NestRequest.socket` is `IncomingMessage['socket'] & Socket`.
  The decode half reads the carrier; a deployment reads the
  message.
- `NodeEnv` is exported again, as the `HttpBindings` shape
  `@hono/node-server` attaches, so a handler annotated
  `Hono<NodeEnv>` keeps its `incoming` and `outgoing` reads. The
  security hook Nest registers is handed `context.env.outgoing`
  where the transport provides it, as it was.

`@hono/node-server` was a required peer before the split and is
one again, and `engines` still names Node: the package is served
by Node's server on either runtime, so the manifest did not have
to move to accommodate the new transports.

`ServerAdapterOptions.overrideGlobalObjects` is read on that
default path and is still on by default, so `@hono/node-server`
replaces the process's `Request` and `Response` with its lighter
classes, exactly as it did before the split. The replacement is
process-wide and not restored, so the suite does not depend on
it: `test/probe.ts` puts the process's own classes back before
every request, and `test/isolation.test.ts` holds that a case
may serve the plain `new ServerAdapter()` in process without
answering for the files beside it. `test/node-server.test.ts`
still serves the same default transport with the switch off and
pins the wiring beside it.

## The adapter chain

Three modules, each extending the one before:

```
RouteAdapter  (core/route-adapter.ts)  extends AbstractHttpAdapter
  HonoLifecycle (core/hono-lifecycle.ts)  adds the Hono app, the
                                          middleware and the server
                                          the injected transport builds
    ServerAdapter (core/server-adapter.ts)  implements the rest of
                                            the Nest contract
```

`core/server.ts` is the `Server` port Nest drives: the `'error'`
event, `address()`, `listen()` and `close()`. Each transport
builds one. `core/transport.ts` is the `Transport` port — how a
server is built, a directory is served and a connection is
upgraded — and `core/bindings.ts` is what a transport attaches
to each request: the request carrier Nest's SSE path reads, and,
where the runtime has one, the native server.

`AbstractHttpAdapter` comes from `@nestjs/core`. The other two
are ours. They are one cohesive unit: splitting them across
regions would mean a class extending something the layer rule
forbids reaching.

## Reading and writing

`core/request.ts` turns a Hono request into the object Nest
reads. `core/response.ts` turns a value Nest returned into a Web
`Response`. They are two halves of one translation and they
share nothing but the type `NestContext`.

The split matters for one concrete reason: `node:stream` is used
only by the half that streams a `StreamableFile`, so the request
half does not import it at all.

It is worth being precise about what the split does **not** buy.
`core/request.ts` still reads `context.env.incoming` to fill in
`raw`, `socket` and `ip`. On the Node transport path, this is
the Node `IncomingMessage` attached by `@hono/node-server`,
including its real socket. On the Bun transport path, the
carrier and socket are synthesized, and the socket reports the
address Bun gives back. The decode half still depends on the
transport bindings; removing an import did not remove that
dependency.

The suite reflects that honestly. `test/probe.ts` passes a
synthetic carrier so most cases can run in process with no
socket, and the handful that need a real one — shutdown and the
WebSocket upgrade — keep it.

Everything that reaches a capability goes through a seam. A
capability is installed into the bridge as an argument rather
than imported by it — `handler-bridge.ts` does not know that
event streams exist. That is the whole point of the seam: the
request path stays free of the optional features.

One detail of the event stream seam decides how a route is
answered, so it is worth knowing before you change
`features/sse.ts` or the bridge that calls it. The stream
surface — the writable Nest pipes its frames into, and the
`write`, `setHeader` and `getHeaders` that go with it — is
installed on the first read of `raw`, not on every request. That
read is what tells an event stream apart from any other answer,
and Nest makes it only on its SSE path: an ordinary route never
builds the writable, never commits a `text/event-stream` answer,
and keeps Hono's own context API on the object `@Res()` hands
it. Installing the surface for every request is what answered
every imperative route as an event stream.

## Errors

There is one funnel. `server-adapter.ts` registers
`createExceptionRunner` on the Hono error handler, and
everything Nest raises arrives there. Handlers that catch
locally do it for a reason they can name: the exception runner
deliberately does not re-read the body, because the failure may
well be that reading it failed.

## The runtime surface

The core names no runtime; the builtin surface is what Nest, the
features and the upload island need wherever they run. Twelve
builtins are in use: `node:buffer`, `node:crypto`,
`node:events`, `node:fs`, `node:fs/promises`, `node:http`,
`node:https`, `node:os`, `node:path`, `node:stream`,
`node:stream/promises` and `node:util`. Nest's own SSE path is a
`node:stream` `Writable`, views read the filesystem with
`node:fs/promises` and `node:path`, the Node transport builds an
`http.Server` with `node:https` for TLS, and the upload island's
disk storage picks a random name with `node:crypto` and a
directory with `node:os`, then names the file with `node:path`
and writes and removes it with `node:fs`, `node:fs/promises` and
`node:stream/promises`. Static assets are not on that list:
`features/static-assets.ts` imports no builtin at all and leaves
the reading to the transport's `serveStatic()`, so the
filesystem is reached for them by whichever transport serves
them. `test/node-builtins.test.ts` freezes that set. Adding one
is a deliberate edit to both the source and the freeze, so the
test failing is the signal, not an obstacle to route around.

Type-only imports count toward the frozen set, because a
type-only import still couples a module's types to the platform.
The builtins are reached from more than the transports: `core/`
takes `node:buffer`, `node:events` and `node:stream` as values
and `node:http` as types, the CORS bridge takes `node:util`, and
views and the island's disk storage take the filesystem ones.
What only a transport does is **build** a server, and that
narrower claim does hold: `servers/node.ts` is the only module
that calls `node:https`, and every other `node:http` import in
`src/` is a type.

## The bundle budget

`.size-limit.json` holds a ceiling per entrypoint, measured by
`size-limit` as a consumer would see it: bundled, minified,
brotlied, with peers external. `bun run check` runs it last, and
CI runs it again as its own job.

The ceilings are ratchets. Growth past one fails, and moving one
is an explicit edit that has to be justified here. Today:
`index` has an 11500-byte ceiling and a measurement of 11491,
`bun-server` 1024/981, `node-server` 560/506, `fetch` 490/487,
`multipart` 4250/4206, and `socket-io` 950/948; the `ws` ceiling
was retired with the entrypoint when the WebSocket adapter moved
to its own package.

**`inject()`.** Fastify's in-process request helper costs 1073
bytes in `index` — 9754 before, 10827 after — against a
9760-byte ceiling that left 6, so `index` moves to 10880. The
feature is read on the first call and on Hono's own
`app.request()`, which is what makes it reach a route without a
port; it lives in `src/core/` rather than in `src/features/`
because it is not optional — the member is on every adapter, and
a feature it cannot be split into two files across would meet
the layer's import rule either way. See
[bundle-baseline.md](bundle-baseline.md) for the measurement.

The signature forms the platform adapters accept arrived next.
`enableCors()` reads a per-request delegate, which means the
CORS bridge builds the request a delegate is handed;
`useStaticAssets()` reads Fastify's single options object with
the root inside it as well as Express's path; and
`setViewEngine()` reads Fastify's options object as well as
Express's engine name. The three cost 483 bytes, more than the
29 the 9300-byte ceiling left, so `index` moves to 9760. That is
the smallest raise that fits: the forms are 454 bytes past the
old ceiling. The same change refuses the `create()` options the
WebSocket adapter cannot serve instead of dropping them, which
costs 11 bytes in `ws` and needs no raise: it measures 1543
inside its unchanged 1550-byte ceiling.

Bounding the response hook's wait requires a timer, cleanup, and
rejection handling that remains active after timeout. With that
fix, `index` measures 9271 bytes, so its ceiling moves from 9250
to 9300. Forwarding transport errors through each WebSocket
client, including safe reporting before binding, brings `ws` to
1532 bytes, so its ceiling moves from 1520 to 1550.

The instrumentation hooks added a step every request crosses.
`setOnRequestHook` and `setOnResponseHook` were inherited as
no-ops, and running them means building the request and response
pair a hook reads on the way in and again once the chain
settles. That costs 229 bytes, more than the 50 the 9000-byte
ceiling left, so `index` moved to 9250. It is the price of the
feature; a deployment that wants the bytes back can do without
the response hook, which is the half that runs after the answer
exists.

The websocket island gained the two pieces of `platform-ws`'s
surface it was missing: the frame parser a deployment can
replace (`messageParser` in the constructor, and
`setMessageParser()`) and `bindErrorHandler()`, which attaches
the error listeners a path and its sockets need. Together they
cost 90 bytes, so `ws` moved from 1430 to 1520. The island is
its own entrypoint, so a deployment that serves no gateway pays
none of it.

The upload island added the multipart seam to `index`: a
`WeakSet` beside the adapter and one branch in the request path,
read per request. That is what raised `index` from 8804 to 8910
and its ceiling from 8900 to 9000. The island itself is its own
entrypoint, so its parser and storage are counted against
`multipart` alone and never against a deployment that serves no
upload.

The streaming interceptor is the same island's second seam, and
it stays there. `FileStreamInterceptor` hands a file part over
as a live `MultipartFileStream` and discards what the handler
leaves; that costs 553 bytes in `multipart` — 3653 to 4206 —
past the 3800-byte ceiling that left 147. The ceiling moves to
4250, which leaves the 44 bytes of headroom `bun-server` runs
with. The raise is deliberate and belongs to this entrypoint
alone: the island may become its own package, so a design that
reads as one beats one that shaves bytes, and no deployment that
serves no upload pays any of it. Three pieces the reconnaissance
in [parity.md](parity.md#file-uploads) calls missing are closed
inside the island. Busboy hands the part over while it is still
parsing, so the handler reads a live stream and the parts after
it are read but not parsed; the discard reads the Web body
rather than cancelling it, because a cancelled body reaches the
client as an aborted request; and the drain upstream defers to
the socket `close` runs before the answer goes out here, unless
the answer is built from the very stream the handler was handed
— `StreamableFile.getStream()` makes that checkable, and an
answer that reads the upload drains the body as it is written.
The interceptor reads `catchError`, `concatMap`, `from` and `of`
from `rxjs` as values; it is a peer the island's consumers
already have, so the gate leaves it out and this entrypoint is
charged nothing for it.

The transport split moved weight between entrypoints rather than
out of the package. `index` serves through the Node transport by
default, so `node-server`'s server-building half is reachable
from it again, and its bytes are back in the neutral entrypoint:
8424 to 8804, ceiling 8500 to 8900. That raise is taken here
deliberately, as the price of not breaking
`new ServerAdapter()`, and it is the number to watch. In
exchange `node-server` lost its `NodeServer` wrapper — it hands
back Node's own `http.Server` with `listen` and `close` adapted
in place — so it fell from 687 to 511 and its ceiling to 560.
`ws` gained the `@hono/node-ws` fallback the transport no longer
carries, 1256 to 1368, ceiling 1400.

`socket-io` is the seventh entrypoint, and the first one added
with a ceiling of its own rather than a raise: 950 bytes,
measured at 916. When the island moved into `packages/socket-io`
and the subpath became a re-export of it, the entrypoint stayed
at 948 bytes under the same 950 ceiling: resolution changed, the
bytes did not. Nothing in it is charged to `index`, because
`./socket-io` is reached only by a deployment that names it, and
`socket.io` is an optional peer the gate leaves out of the
measurement the way it leaves out `@hono/node-ws`. The island is
three modules — the adapter, the refusal that names the
transport a deployment must serve through instead, and the
entrypoint that re-exports both — and the 34 bytes of headroom
left under the ceiling are in the range the other entries keep,
from `ws`'s 10 to `fetch`'s 62.

The application settings arrived next. `setLocal()`, `set()`,
`enable()` and `disable()` add the last piece of Express's
application surface this adapter can carry honestly: a local
written after the application starts reaches the next render.
Locals are stored separately from the `defaultContext`
configured through `setViewEngine()`; each render combines
defaults, locals, and handler data in that order. Special keys
such as `__proto__` remain own data properties. The two settings
that name behaviour — `view engine` and `views` — delegate to
`setViewEngine()` and `setBaseViewsDir()` while every other name
is refused with a reason rather than stored. That costs 206
bytes in `index` — 10856 before, 11062 after — past the
10880-byte ceiling that left 24, so `index` moves to 11090 and
keeps 28 bytes of headroom. The refusal reasons are 74 bytes of
the total, measured by dropping the map; shortening the
explanatory half of the `trust proxy` reason would save 19 of
those, and the rest is the shared text and the setting names.
The methods and the honoured set are the other 132 bytes, so the
cost does not come down without losing either the reason or the
refusal.

The helpers live in `core/hono-lifecycle.ts` rather than beside
`set()` in `core/server-adapter.ts`, because that file is at its
14-dependency ceiling and its 450-line ceiling, and `views.ts` —
the natural home for the `view engine` and `views` names — is at
388 of its 400 lines. The module augmentation that declares the
surface on `INestApplication` stays in `core/app-settings.ts`
and reads its parameter types off `ServerAdapter`, which is what
keeps that file inside the layer map: naming the view and
static-asset option types directly would draw the `core/` to
`features/` edge only the two composition roots may take.

Validating directory arrays, preserving locals when defaults are
configured, and treating `__proto__` as own render data bring
`index` to 11123 bytes. These corrections exceed its 11090-byte
ceiling by 33 bytes, so the ceiling moves to 11130. The other
entrypoints retain their existing ceilings.

Enforcing the body limit while the payload is read rather than
once it is resident costs 83 bytes in `index` — 11172 before,
11255 after — past the 11180-byte ceiling that left 8, so
`index` moves to 11260. It is the price of the streaming
ceiling: the counting pass is a `TransformStream` and the
`Response` around it, both platform globals the bundler does not
charge for, so the bytes are the glue and not the machinery. The
last 28 of them came later, so that a body earlier Hono
middleware had already read is checked against the limit from
its cached bytes rather than read again. The alternative was a
body no client needs to declare a length for, which is not a
ceiling at all.

Answering two cookies as two headers costs 42 bytes in `index` —
11123 before, 11172 after — past the 11130-byte ceiling that
left 7, so `index` moves to 11180. It is the price of keeping a
repeated `set-cookie` apart: the record an answer is built from
converts a sequence value with the WebIDL `ByteString`
converter, which joins it with a comma, so the one header that
cannot be folded is handed to the constructor as pairs instead.
Every other repeated header still folds, and a record with no
repeated `set-cookie` is still written straight through.

Reading what the payload declares about itself costs 214 bytes
in `index` — 11255 before, 11469 after — past the 11260-byte
ceiling that left 5, so `index` moves to 11480. The bytes are
the `charset` parameter parser, the decoder table for the family
the platform reads, the two refusals, and the module boundary
that keeps `body.ts` under its line ceiling now that it also
counts a streamed body; what they buy is an answer the other
adapters already give, where a UTF-16LE JSON body decodes rather
than failing and a charset or content encoding this adapter
cannot read is refused with the platform's 415 instead of being
handed to `JSON.parse`.

Creating charset decoders on demand and rejecting unsupported
`useBodyParser()` names require a small increase in `index`. Its
ceiling moves from 11480 to 11500 bytes to cover these checks;
the other entrypoint ceilings stay as declared.

Answering `listen()` with the reason it cannot run costs 69
bytes in `fetch` — 418 before, 487 after — past its 480-byte
ceiling, so `fetch` moves to 490. Almost all of it is the
message: a fetch host hands the adapter its requests, so a
deployment that waits on `listen()` waits forever, and Nest
settles that promise only from the callback this transport now
answers with an `Error`.

Throwing the same refusal when no callback is supplied brings
`fetch` to 496 bytes, so its ceiling moves from 490 to 500.

Two consequences worth knowing before you write code:

- **Extracting a helper costs bytes.** The bundler does not
  inline module-level `function` declarations. Moving code is
  free; pulling it apart is not.
- **Import order is not free either.** The order of the import
  statements in `core/server-adapter.ts` and
  `core/hono-lifecycle.ts` is load-bearing for the measurement.
  Alphabetising them costs five bytes. Leave them.

If a change genuinely needs more room, say so in the change
rather than quietly raising the ceiling. The budget is the
product.

## Where the guards live

| File                                 | What it holds                       |
| ------------------------------------ | ----------------------------------- |
| `test/layers.test.ts`                | the five dependency rules           |
| `test/entry-points.test.ts`          | subpath isolation                   |
| `test/node-builtins.test.ts`         | the frozen builtin set              |
| `test/types/application-surface.ts`  | the types a consumer reads through  |
| `test/types/route-adapter-compat.ts` | the members two Nest versions share |
| `.oxlintrc.json`                     | rule exceptions, each with a reason |

The `.oxlintrc.json` exception for `src/multipart/**` is the
widest one, and it is taken because the island mirrors multer's
semantics and `append-field`'s port: it keeps multer's
`_handleFile` / `_removeFile` names and its `Error | null`
callbacks, and its request-shaped parser has more parameters and
statements per function than the house style allows. The
type-safety rules stay on everywhere else. Relaxing a rule for
one file rather than for the region is preferred when a
single-file exception is enough, which is also why
`FileStreamInterceptor` sits in
`interceptors/file.interceptor.ts` beside the buffered one
rather than in a file of its own: file names, not directories,
are what those blocks name, so a new file would mean a new
exception rather than a moved one.

Two later exceptions follow the same rule. `test/**` carries a
700-line ceiling rather than 400, because an end-to-end suite
holds its fixtures, its gateways and its cases in one file and
grows as they do; `test/websockets.test.ts` is the largest of
them. And `src/ws/adapter.ts` carries 450, the value the two
files above it take: it is the island's composition point, where
the `AbstractWsAdapter` members it implements meet the
`platform-ws` surface — the frame parser and the error handlers
— that a consumer of that adapter reads.
