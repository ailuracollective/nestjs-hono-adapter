# Architecture

The shape the adapter is built in, and which shapes are refused.
The README says what it does.

## The regions of `packages/`

```
packages/
  core/      the adapter, published as
             @ailura/nestjs-hono-adapter: its src/core/ (the Nest
             <-> Hono translation and the ports), src/features/
             (the optional capabilities), src/servers/ (the
             runtime transports)
  socket-io/ the Socket.IO island, published as
             @ailura/nestjs-platform-hono-socket-io
  ws/        the WebSocket island, published as
             @ailura/nestjs-platform-hono-ws
  multipart/ the upload island, published as
             @ailura/nestjs-platform-hono-multipart
```

The implementation is `packages/core/src/`; the repository root
is only the private Bun workspace root — no package, no `src/`,
no exports. Region names below are directories under
`packages/core/src/` unless a package is named.

**`core/`** holds the translation and the adapter chain, the
`Server`/`Transport` ports, and the primitives translation
needs. It alone knows both Nest's contract and Hono's objects,
and names no runtime.

**`features/`** holds the capabilities a deployment may turn on:
CORS, event streams, static assets, views. Each is optional at
runtime, and none may reach sideways into another.

**The transports** are `servers/bun.ts`, `servers/node.ts` and
`servers/fetch.ts`. Each is reached only through its own subpath
and reaches `core/` for the ports it implements; a deployment
loads one. The fetch transport serves a host that hands over a
Web `Request` and expects a Web `Response` — Cloudflare Workers,
Vercel Functions, Deno — where nothing listens.

**The WebSocket island** lives in `packages/ws` and is neutral:
it asks the adapter for its transport rather than importing a
runtime's own WebSocket module.

**The upload island** lives in `packages/multipart`, published
as `@ailura/nestjs-platform-hono-multipart`. It alone consumes a
`multipart/form-data` body and alone depends on a parser
(`busboy`, an optional peer of the adapter and a required one of
the package). Its interceptors parse the body the way multer
does, so `@UploadedFile()` and `@UploadedFiles()` work;
importing it marks the adapter through `declareMultipart`, the
one symbol the core publishes on purpose for it, and a marked
adapter leaves a multipart body alone for an interceptor to
consume. An adapter that serves no upload carries no trace of
it.

## The dependency rules

Five rules, all enforced by `test/layers.test.ts`:

1. `core/` never reaches `features/`, **except** from
   `core/server/hono-lifecycle.ts` and
   `core/server/server-adapter.ts`.
2. `features/` never reaches `features/`.
3. `features/` never reaches the WebSocket island.
4. The islands that call the application reach it as the
   published package, never as an internal path: the core is a
   **type-only import** for the WebSocket island, and a
   type-only import plus the `declareMultipart` marker for the
   upload island.
5. The socket.io island reaches `core/` and `features/` not at
   all, as a value or as a type.

The rule-1 exceptions are the composition root, the modules that
turn a capability into a running adapter; everything else in
`core/` is reached only by Nest's contract.
`packages/ws/src/adapter.ts` imports `ServerAdapter` with
`import type`, erased at compile time, so the `/ws` subpath
never loads the HTTP adapter; as a value import it would cost an
HTTP-only deployment a WebSocket stack. The upload island
imports `declareMultipart` as a value from
`packages/multipart/src/multipart/multipart.interceptor.factory.ts`,
marking the adapter, and otherwise reaches the core only as
types. The socket.io island names nothing in `core/` or
`features/`: Nest hands it the server it already built, so
`packages/socket-io/src/adapter.ts` needs no port or composition
root — its runtime graph is `socket.io` and the three modules
behind its entrypoint, and `test/layers.test.ts` refuses the
value and type edges that would change that.

Packaging, not layering: `core/` never imports
`servers/fetch.ts`, and imports `servers/bun.ts` only from
`core/server/server-adapter.ts`, which hands the adapter the
transport it serves through when a deployment names none. That
keeps `new ServerAdapter()` served, and costs the `.` entrypoint
a top-level `hono/bun` resolution that keeps the module loadable
on Node and makes the package ESM only, so `require()` throws.

`packages/core/src/core/server/application.ts` is all types: the
interface a bootstrap hands `NestFactory.create()`, and the
member this package declares on Nest's `HttpServer` so
`getHono()` is reachable out of `getHttpAdapter()`. Every import
is `import type`, so it costs the bundle nothing;
`packages/core/test/types/application-surface.ts` holds that at
compile time.

## How a module names another

A parent-relative import — `../../features/cors/index.ts` from
`core/server/` — is refused by
`import/no-relative-parent-imports`, and `.oxlintrc.json`
carries no exception. Each tree is named by an alias instead:

| Alias               | Names                       |
| ------------------- | --------------------------- |
| `#adapter/*`        | `packages/core/src/`        |
| `#multipart/*`      | `packages/multipart/src/`   |
| `#ws/*`             | `packages/ws/src/`          |
| `#socket-io/*`      | `packages/socket-io/src/`   |
| `#adapter-test/*`   | `packages/core/test/`       |
| `#multipart-test/*` | `packages/multipart/test/`  |
| `#test/*`           | `test/`, the shared harness |
| `#root/*`           | the repository root         |

A sibling travels as `./sibling.ts`: the alias crosses a tree,
not every import. So a package's tests reach `test/probe.ts` as
`#test/probe`, and `test/entry-points/` reads the four manifests
as `#root/packages/<name>/package.json`.

An alias carries no extension — `#adapter/core/context`, not
`#adapter/core/context.ts` — because the compiler refuses a
`.ts` on a specifier it cannot rewrite, and
`rewriteRelativeImportExtensions` rewrites relative ones only.
The `paths` target resolves it: each package's `tsconfig.json`
maps the aliases its sources and tests use, `packages/core` and
`packages/multipart` map their own in `tsconfig.build.json`,
`test/tsconfig.json` maps every tree because it typechecks them
all in one project, and both Cloudflare examples map
`#adapter/`.

A built package carries the alias into `dist/`, so the published
`imports` map in `packages/core/package.json` and
`packages/multipart/package.json` resolves it at runtime —
`#adapter/*` to `./dist/*.js`. A consumer never writes one.

## Entrypoints and isolation

`@ailura/nestjs-hono-adapter`, built from `packages/core`,
exposes four specifiers: `.`, `./bun-server`, `./node-server`
and `./fetch`. Each optional capability is its own package with
a single specifier, `.`: `@ailura/nestjs-platform-hono-ws`,
`@ailura/nestjs-platform-hono-multipart` and
`@ailura/nestjs-platform-hono-socket-io`. The adapter depends on
none of the three; `ws` and `multipart` peer on the adapter
(`>=1.4.1 <2`).

The build is `build:core` then `build:packages`; each capability
package compiles its own sources into its own `dist/`, and the
published maps expose nothing else, so no consumer reaches an
internal module by path — moving files between regions is not a
breaking change.

The `./ws`, `./multipart` and `./socket-io` subpaths are gone.
`./ws` was published through 1.4.1 and now lives in
`@ailura/nestjs-platform-hono-ws`; `./multipart` and
`./socket-io` only existed on `main` and were never published.
The
[README](../packages/core/README.md#migrating-from-the-old-subpaths)
records what to install instead.

`test/entry-points.test.ts` walks the import graph transitively
from the neutral entrypoints and fails if `.` reaches
`@hono/node-ws` or `@nestjs/websockets`, the optional peers: an
HTTP deployment must not need either installed. It checks the
opposite direction too, since `.` resolves `hono/bun` through
the Bun transport's dynamic import, which is why it reads both
import shapes. `@ailura/nestjs-platform-hono-ws` is the only
package reaching the WebSocket peers,
`@ailura/nestjs-platform-hono-socket-io` the only one reaching
`socket.io`, `@ailura/nestjs-platform-hono-multipart` the only
one reaching `busboy`. `test/layers.test.ts` reads
`packages/core/src` as the layered source and the three
`packages/*/src` as islands; `test/entry-points.test.ts` starts
from the adapter's `index.ts` and asks each island for its peers
at the package. It reads the manifests too, because the
direction is about what a deployment installs: the adapter
declares none of the three capability packages among its
dependencies, optional dependencies or peers, and no capability
package declares another.

`entry-points.test.ts` counts a type-only import as an edge;
`layers.test.ts` distinguishes them — deliberately, since the
entrypoint guard is conservative and the layer guard must be
precise for rule 4.

## The compatibility face

Names that carry the shape the package published before the
transports split:

- `getHttpServer()` is `Server & http.Server`; the Node
  transport hands back Node's own server with `listen` and
  `close` adapted in place, keeping `closeAllConnections()` and
  an `'upgrade'` listener.
- `NestRequest.raw` is `IncomingMessage & Incoming`;
  `NestRequest.socket` is `IncomingMessage['socket'] & Socket`.
- `NodeEnv` is exported again, as the `HttpBindings` shape
  `@hono/node-server` attaches, so a handler annotated
  `Hono<NodeEnv>` keeps its `incoming` and `outgoing` reads. The
  security hook Nest registers is handed `context.env.outgoing`
  where the transport provides it.

`@hono/node-server` is a required peer again, and `engines`
still names Node: the Node transport answers an `http.Server`,
and a deployment that names it runs on Node or Bun.

`ServerAdapterOptions.overrideGlobalObjects` left with the
implicit default it configured. The Node transport carries the
option and defaults it to `true`, the fastest path and the
behavior the implicit Node transport had; a deployment that
wants the globals left alone names it
`nodeServer({ overrideGlobalObjects: false })`. The replacement
is process-wide and not restored, so `test/probe.ts` puts the
process's own classes back before every request, and
`packages/core/test/isolation.test.ts` holds that a case may
serve the plain `new ServerAdapter()` in process without
answering for the files beside it.

## The adapter chain

Three modules, each extending the one before:

```
RouteAdapter  (core/route/route-adapter.ts)  extends AbstractHttpAdapter
  HonoLifecycle (core/server/hono-lifecycle.ts)  adds the Hono app, the
                                          middleware and the server
                                          the injected transport builds
    ServerAdapter (core/server/server-adapter.ts)  implements the rest of
                                            the Nest contract
```

`core/ports/server.ts` is the `Server` port Nest drives: the
`'error'` event, `address()`, `listen()` and `close()`. Each
transport builds one. `core/ports/transport.ts` is the
`Transport` port — how a server is built, a directory is served,
a connection is upgraded — and `core/ports/bindings.ts` is what
a transport attaches to each request: the request carrier Nest's
SSE path reads, and, where the runtime has one, the native
server.

`AbstractHttpAdapter` comes from `@nestjs/core`; the other two
are ours, one cohesive unit, since splitting them would have a
class extend something the layer rule forbids reaching.

## Reading and writing

`core/request/request.ts` turns a Hono request into the object
Nest reads; `core/response/response.ts` turns a value Nest
returned into a Web `Response`. They share only the type
`NestContext`. `node:stream` is used only by the response half
(the `StreamableFile`), so the request half does not import it.
The request half still reads `context.env.incoming` to fill in
`raw`, `socket` and `ip`, so it depends on the transport
bindings: the Node path gets the Node `IncomingMessage` and its
real socket; the Bun path synthesizes the carrier and socket,
which reports the address Bun gives back.

Every capability reaches the bridge through a seam, installed as
an argument, not imported — `handler-bridge.ts` does not know
event streams exist. The event stream surface (the writable Nest
pipes frames into, with `write`, `setHeader`, `getHeaders`) is
installed on the first read of `raw`, not on every request: that
read distinguishes an event stream, and Nest makes it only on
its SSE path, so an ordinary route keeps Hono's context API on
the `@Res()` object.

## Errors

One funnel: `server-adapter.ts` registers
`createExceptionRunner` on the Hono error handler, and
everything Nest raises arrives there. The runner does not
re-read the body, because the failure may be that reading it
failed.

## The runtime surface

The core names no runtime; the builtin surface is what Nest and
the features need wherever they run. Eight builtins are in use:
`node:buffer`, `node:events`, `node:fs/promises`, `node:http`,
`node:https`, `node:path`, `node:stream` and `node:util`. Nest's
SSE path is a `node:stream` `Writable`; views read the
filesystem with `node:fs/promises` and `node:path`; the Node
transport builds an `http.Server` with `node:https` for TLS.
Static assets are not on the list:
`features/static-assets/index.ts` imports no builtin and leaves
reading to the transport's `serveStatic()`.
`test/node-builtins.test.ts` freezes the set, scanning
`packages/core/src/`; adding one is a deliberate edit to both
the source and the freeze.

The upload package is outside that scan and reaches four
builtins the core does not: `node:crypto`, `node:fs`, `node:os`
and `node:stream/promises`. Its disk storage picks a random name
with `node:crypto` and a directory with `node:os`, then names
the file with `node:path` and reads and writes it with
`node:fs`, `node:fs/promises` and `node:stream/promises` —
`node:path` and `node:fs/promises` are already on the core's
list.

Type-only imports count toward the frozen set. The builtins are
reached from more than the transports: `core/` takes
`node:buffer`, `node:events` and `node:stream` as values and
`node:http` as types, the CORS bridge takes `node:util`, and
views take the filesystem ones. Only a transport **builds** a
server: `servers/node.ts` is the only module that calls
`node:https`, and every other `node:http` import in the core's
source is a type.

## The bundle budget

Each package holds its own `.size-limit.json` beside its
`package.json`: `packages/core` carries the four adapter
entrypoints; `packages/ws`, `packages/socket-io` and
`packages/multipart` their single one, each with a
package-relative path. `size-limit` measures an entrypoint as a
consumer sees it: bundled, minified, brotlied, peers external.
The root `size` script builds then runs
`bun run --filter './packages/*' size`; `bun run check` runs it
last, and CI runs it as its own job. The measured values are in
[bundle-baseline.md](bundle-baseline.md).

The ceilings are ratchets: growth past one fails, and moving one
is an explicit edit justified here. Current ceiling/measured:
`index` 12000/11944, `bun-server` 1024/1003, `node-server`
560/506, `fetch` 500/496, `multipart` 4250/4200, `ws` 1650/1618
and `socket-io` 950/948. Entry names are unchanged: the first
four measure `packages/core/dist`, and `multipart`, `ws` and
`socket-io` their own `packages/<name>/dist`. The upload
island's streaming seam closes three pieces the reconnaissance
in [parity.md](parity.md#file-uploads) calls missing.

Two consequences before you write code:

- **Extracting a helper costs bytes.** The bundler does not
  inline module-level `function` declarations. Moving code is
  free; pulling it apart is not.
- **Import order is not free either.** The order of the import
  statements in `core/server/server-adapter.ts` and
  `core/server/hono-lifecycle.ts` is load-bearing for the
  measurement. Alphabetising them costs five bytes. Leave them.

If a change genuinely needs more room, say so in the change
rather than quietly raising the ceiling. The budget is the
product. See [bundle-baseline.md](bundle-baseline.md) for the
measured baseline.

## Where the guards live

| File                                               | What it holds                       |
| -------------------------------------------------- | ----------------------------------- |
| `test/layers.test.ts`                              | the five dependency rules           |
| `test/entry-points.test.ts`                        | subpath isolation, declarations     |
| `test/node-builtins.test.ts`                       | the frozen builtin set              |
| `packages/core/test/types/application-surface.ts`  | the types a consumer reads through  |
| `packages/core/test/types/route-adapter-compat.ts` | the members two Nest versions share |
| `.oxlintrc.json`                                   | rule exceptions, each with a reason |

The root `test/` holds only what guards the monorepo and what
more than one package shares: the guards above and the shared
probe and helpers (`test/probe.ts`, `test/bun-adapter.ts`,
`test/bun-bindings.ts`), reached as `#test/probe.ts`,
`#test/bun-adapter.ts` and so on. Each package's behaviour tests
live in its own `packages/<name>/test/` with its own `test`
script.

`.oxlintrc.json` takes the widest exceptions over
`packages/multipart/src/**`, because the island mirrors multer's
semantics and `append-field`'s port: multer's `_handleFile` /
`_removeFile` names and `Error | null` callbacks, and a
request-shaped parser with more parameters and statements per
function than the house style allows. Type-safety rules stay on
elsewhere, and a rule is relaxed for one file rather than the
region — also why `FileStreamInterceptor` sits in
`interceptors/file.interceptor.ts` beside the buffered one.

`test/**` and `packages/*/test/**` carry a 700-line ceiling
rather than 400, because an end-to-end suite holds its fixtures,
gateways and cases in one file; `packages/ws/src/adapter.ts`
carries 450, its composition point where the `AbstractWsAdapter`
members meet the `platform-ws` surface it implements.
`packages/core/src/features/cors/index.ts` sits at exactly 400
lines and stays whole: rule 2 leaves it no seam, since any edge
between two files of `features/` fails the guard. Its analogues
are larger — `express-adapter.ts` 710 lines,
`fastify-adapter.ts` 1,433.

The Bun transport is split along its seam:
`servers/bun-runtime.ts` holds Bun's server and TLS option
types, the TLS mapping, and the static-file middleware reading
`Bun.file`; `servers/bun.ts` keeps the Node-shaped server Nest
drives, its fetch bindings, the `hono/bun` websocket helper and
the transport factory, at 315 lines — the helper installs on the
server the factory builds, and the factory serves through that
class's fetch handler.
