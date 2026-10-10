# Architecture

This is the map a contributor needs before changing a file. The
README describes what the adapter does; this describes the shape
it is built in, and which shapes are refused.

## The regions of `src/`

```
src/
  index.ts  ws/index.ts                  the neutral entrypoints
  servers/bun.ts  servers/node.ts  servers/fetch.ts   the runtime transports
  ws/adapter.ts  ws/client.ts  ws/server.ts   the WebSocket island
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

## The dependency rules

Four rules, all enforced by `test/layers.test.ts`:

1. `core/` never reaches `features/`, **except** from
   `core/hono-lifecycle.ts` and `core/server-adapter.ts`.
2. `features/` never reaches `features/`.
3. `features/` never reaches the WebSocket island.
4. The island reaches `core/` and `features/` **only through
   type-only imports**.

Rule 1 has exactly two exceptions because exactly two modules
are the composition root: they are the ones that turn a
capability into a running adapter. Everything else in `core/` is
reached only by Nest's contract.

Rule 4 is the load-bearing one. `src/ws/adapter.ts` does import
`ServerAdapter`, and it does so with `import type`. That is
erased at compile time, so the `/ws` subpath never loads the
HTTP adapter. The moment that becomes a value import, a
deployment that only serves HTTP pays for a WebSocket stack.

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

The `exports` map in `package.json` exposes five specifiers:
`.`, `./bun-server`, `./node-server`, `./fetch` and `./ws`. It
exposes nothing else, so no consumer can reach an internal
module by path — which is what makes it safe to move files
between regions without it being a breaking change.

`test/entry-points.test.ts` walks the import graph transitively
from the neutral entrypoints. It fails if `.` reaches
`@hono/node-ws` or `@nestjs/websockets`, the optional peer
dependencies: a deployment that serves HTTP must not need either
installed. It checks the opposite direction too, because
`@hono/node-server` is required and reached on purpose: `.`
serves through it when no transport is named, which is the
behaviour every deployment had before the transports split.
`./ws` is the only entrypoint that reaches the island's peers.

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
process-wide and not restored, which is why no case in the suite
serves the plain `new ServerAdapter()`:
`test/node-server.test.ts` serves the same default transport
with the switch off and pins the wiring beside it.

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

The core names no runtime; the builtin surface is what Nest and
the features need wherever they run. Eight builtins are in use:
`node:buffer`, `node:events`, `node:fs/promises`, `node:http`,
`node:https`, `node:path`, `node:stream` and `node:util`. Nest's
own SSE path is a `node:stream` `Writable`, views and static
assets read the filesystem, and the Node transport builds an
`http.Server` with `node:https` for TLS.
`test/node-builtins.test.ts` freezes that set. Adding one is a
deliberate edit to both the source and the freeze, so the test
failing is the signal, not an obstacle to route around.

Type-only imports count toward the frozen set, because a
type-only import still couples a module's types to the platform.
A transport's modules are the only ones that reach the builtins
a runtime owns.

## The bundle budget

`.size-limit.json` holds a ceiling per entrypoint, measured by
`size-limit` as a consumer would see it: bundled, minified,
brotlied, with peers external. `bun run check` runs it last, and
CI runs it again as its own job.

The ceilings are ratchets. Growth past one fails, and moving one
is an explicit edit that has to be justified here. Today:
`index` has an 8900-byte ceiling and a measurement of 8804,
`bun-server` 1024/981, `node-server` 560/511, `fetch` 480/437
and `ws` 1400/1368.

The split moved weight between entrypoints rather than out of
the package. `index` serves through the Node transport by
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
| `test/layers.test.ts`                | the four dependency rules           |
| `test/entry-points.test.ts`          | subpath isolation                   |
| `test/node-builtins.test.ts`         | the frozen builtin set              |
| `test/types/application-surface.ts`  | the types a consumer reads through  |
| `test/types/route-adapter-compat.ts` | the members two Nest versions share |
| `.oxlintrc.json`                     | rule exceptions, each with a reason |
