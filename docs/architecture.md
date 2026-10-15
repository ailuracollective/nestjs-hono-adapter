# Architecture

The shape the adapter is built in, and which shapes are refused. The README says what it does.

## The regions of `packages/`

```
packages/
  core/          the adapter, published as
                 @ailura/nestjs-hono-adapter: its src/core/ (the Nest
                 <-> Hono translation and the ports), src/features/
                 (the optional capabilities), src/compat/ (the
                 bridges to the platforms Nest users write against),
                 src/servers/ (the runtime transports)
  multipart/     the upload island, published as
                 @ailura/nestjs-platform-hono-multipart
  graphql/       the Apollo bridge, published as
                 @ailura/nestjs-platform-hono-graphql
  serve-static/  the @nestjs/serve-static bridge, published as
                 @ailura/nestjs-platform-hono-serve-static
  socket-io/     the Socket.IO bridge, published as
                 @ailura/nestjs-platform-hono-socket-io
  ws/            the @nestjs/platform-ws bridge, published as
                 @ailura/nestjs-platform-hono-ws
```

The implementation is `packages/core/src/`; the repository root is only the private Bun workspace root — no package, no `src/`, no exports. Region names below are directories under `packages/core/src/` unless a package is named.

**`core/`** holds the translation and the adapter chain, the `Server`/`Transport` ports, and the primitives translation needs. It alone knows both Nest's contract and Hono's objects, and names no runtime.

**`features/`** holds the capabilities a deployment may turn on: CORS, event streams, static assets, views. Each is optional at runtime, and none may reach sideways into another.

**`compat/`** holds the bridges: the shims that exist only because the code they serve was written for Express or Fastify — `res.send()`, an `(err, req, res, next)` middleware, a `@nestjs/serve-static` loader. It is a region of this package, not a capability, so it is not a package of its own: an Express-shaped call is part of running a Nest application, and a deployment gets it from the `.` entrypoint without installing anything. It reaches `core/` and `features/` freely and nothing reaches it sideways. What it is, what it costs and how a deployment extends it are in [compatibility.md](compatibility.md).

**The transports** are `servers/bun.ts`, `servers/node.ts` and `servers/fetch.ts`. Each is reached only through its own subpath and reaches `core/` for the ports it implements; a deployment loads one. The fetch transport serves a host that hands over a Web `Request` and expects a Web `Response` — Cloudflare Workers, Vercel Functions, Deno — where nothing listens.

**The WebSocket bridge** lives in `packages/ws`, published as `@ailura/nestjs-platform-hono-ws`: it replaces the one member of Nest's own `@nestjs/platform-ws` `WsAdapter` that builds a server — `create()` — so a gateway is served as a route on the Hono application, and the adapter's own `bindMessageHandlers()`, `bindErrorHandler()` and `close()` run against the server the bridge hands it. A transport that carries no websocket helper keeps the stock path.

**The Socket.IO bridge** lives in `packages/socket-io`, published as `@ailura/nestjs-platform-hono-socket-io`: it replaces the one member of Nest's own `@nestjs/platform-socket.io` `IoAdapter` that builds a server — `createIOServer()` — so a gateway binds to the transport's own server through a socket.io engine where the transport offers one, and the adapter's own `create()`, `mapPayload()`, `bindMessageHandlers()`, `bindClientDisconnect()` and `close()` run against what it returns. A server the engine cannot bind to keeps the stock path.

**The upload island** lives in `packages/multipart`, published as `@ailura/nestjs-platform-hono-multipart`. It alone consumes a `multipart/form-data` body and alone depends on a parser (`busboy`, an optional peer of the adapter and a required one of the package). Its interceptors parse the body the way multer does, so `@UploadedFile()` and `@UploadedFiles()` work; importing it marks the adapter through `declareMultipart`, the one symbol the core publishes on purpose for it, and a marked adapter leaves a multipart body alone for an interceptor to consume. An adapter that serves no upload carries no trace of it.

## The dependency rules

Five rules, all enforced by `test/layers.test.ts`:

1. `core/` never reaches `features/`, **except** from `core/server/hono-lifecycle.ts` and `core/server/server-adapter.ts`.
2. `features/` never reaches another feature.
3. `features/` never reaches a bridge package.
4. The island that calls the application reaches it as the published package, never as an internal path: a type-only import plus the `declareMultipart` marker for the upload island.
5. `core/` reaches `compat/` only from the two composition roots, and `features/` never reaches it at all. The one further exception is `core/route/handler-bridge/request.ts`, which names `compat/express/surface.ts` to fit `res.send()` onto a `@Res()` object.

The rule-1 exceptions are the composition root, the modules that turn a capability into a running adapter; everything else in `core/` is reached only by Nest's contract. The upload island imports `declareMultipart` as a value from `packages/multipart/src/multipart/multipart.interceptor.factory.ts`, marking the adapter, and otherwise reaches the core only as types. A bridge package reaches the adapter through the published entrypoint and nowhere else, which is what lets `packages/socket-io` read the transport's server by capability, not by class, the way `ws` reads the transport: a server that offers `useNativeHandler()` — the Bun transport's slot, a structural port the bridge reads without importing the core — is served by a socket.io engine bound to it; any other server is served the way socket.io has always served one, on its `http.Server`. So a gateway attaches to `Bun.serve` or to a Node server through the same adapter, and a transport that offers neither is refused by name rather than by inspecting it.

Packaging, not layering: `core/` never imports `servers/fetch.ts`, and imports `servers/bun.ts` only from `core/server/server-adapter.ts`, which hands the adapter the transport it serves through when a deployment names none. That keeps `new ServerAdapter()` served, and costs the `.` entrypoint a top-level `hono/bun` resolution that keeps the module loadable on Node and makes the package ESM only, so `require()` throws.

`packages/core/src/core/server/application.ts` is all types: the interface a bootstrap hands `NestFactory.create()`, and the member this package declares on Nest's `HttpServer` so `getHono()` is reachable out of `getHttpAdapter()`. Every import is `import type`, so it costs the bundle nothing; `packages/core/test/types/application-surface.ts` holds that at compile time.

## How a module names another

A parent-relative import — `../../features/cors/index.ts` from `core/server/` — is refused by `import/no-relative-parent-imports`, and `.oxlintrc.json` carries no exception. Each tree is named by an alias instead:

| Alias               | Names                       |
| ------------------- | --------------------------- |
| `#adapter/*`        | `packages/core/src/`        |
| `#multipart/*`      | `packages/multipart/src/`   |
| `#adapter-test/*`   | `packages/core/test/`       |
| `#multipart-test/*` | `packages/multipart/test/`  |
| `#test/*`           | `test/`, the shared harness |
| `#root/*`           | the repository root         |

A sibling travels as `./sibling.ts`: the alias crosses a tree, not every import. So a package's tests reach `test/probe.ts` as `#test/probe`, and `test/entry-points/` reads the four manifests as `#root/packages/<name>/package.json`.

An alias carries no extension — `#adapter/core/context`, not `#adapter/core/context.ts` — because the compiler refuses a `.ts` on a specifier it cannot rewrite, and `rewriteRelativeImportExtensions` rewrites relative ones only. The `paths` target resolves it: each package's `tsconfig.json` maps the aliases its sources and tests use, `packages/core` and `packages/multipart` map their own in `tsconfig.build.json`, `test/tsconfig.json` maps every tree because it typechecks them all in one project, and both Cloudflare examples map `#adapter/`.

A built package carries the alias into `dist/`, so the published `imports` map in `packages/core/package.json` and `packages/multipart/package.json` resolves it at runtime — `#adapter/*` to `./dist/*.js`. A consumer never writes one.

## Entrypoints and isolation

`@ailura/nestjs-hono-adapter`, built from `packages/core`, exposes four specifiers: `.`, `./bun-server`, `./node-server` and `./fetch`. The optional capability is its own package with a single specifier, `.`: `@ailura/nestjs-platform-hono-multipart`, and so is each bridge package: `@ailura/nestjs-platform-hono-graphql`, `@ailura/nestjs-platform-hono-serve-static`, `@ailura/nestjs-platform-hono-socket-io` and `@ailura/nestjs-platform-hono-ws`. The adapter depends on none of the five; every one of them peers on it (`>=1.4.1 <2`, and the three that require it name the beta lines as well while the [pre-release channel](development.md#pre-release-channel) is open, because a prerelease version satisfies no plain range).

The build is `build:core` then `build:packages`; each capability package compiles its own sources into its own `dist/`, and the published maps expose nothing else, so no consumer reaches an internal module by path — moving files between regions is not a breaking change.

The `./ws`, `./multipart` and `./socket-io` subpaths are gone. `./ws` was published through 1.4.1 and now lives in `@ailura/nestjs-platform-hono-ws`; `./multipart` and `./socket-io` only existed on `main` and were never published. The [README](../packages/core/README.md#migrating-to-2x) records what to install instead.

`test/entry-points.test.ts` walks the import graph transitively from the neutral entrypoints and fails if `.` reaches `@hono/node-ws` or `@nestjs/websockets`, the optional peers: an HTTP deployment must not need either installed. It checks the opposite direction too, since `.` resolves `hono/bun` through the Bun transport's dynamic import, which is why it reads both import shapes. `@ailura/nestjs-platform-hono-ws` is the only package reaching `@nestjs/platform-ws`, `@ailura/nestjs-platform-hono-socket-io` the only one reaching `socket.io` (and the `@socket.io/bun-engine` it loads as an optional peer on Bun), `@ailura/nestjs-platform-hono-multipart` the only one reaching `busboy`. `test/layers.test.ts` reads `packages/core/src` as the layered source, the one `packages/multipart/src` capability as an island and the four bridge packages as bridges; `test/entry-points.test.ts` starts from the adapter's `index.ts` and asks each package for its peers. It reads the manifests too, because the direction is about what a deployment installs: the adapter declares none of the five packages among its dependencies, optional dependencies or peers, and no capability package declares another.

`entry-points.test.ts` counts a type-only import as an edge; `layers.test.ts` distinguishes them — deliberately, since the entrypoint guard is conservative and the layer guard must be precise for rule 4.

## The compatibility region

`compat/` holds the bridges, and nothing else does. A bridge is a named install — a `name` and an `install(target)` — held in `compat/registry/`, installed once per Hono application from the composition root and, when it has to resolve an optional peer, settled from `ServerAdapter.init()`, the hook Nest awaits before `onModuleInit`.

Four bridges ship. One is here: `express`, the `res.send()` / `res.type()` surface and the `(err, req, res, next)` middleware, which every deployment gets without installing anything. The other three belong to a platform Nest users write against and live in their own packages — `serve-static`, the loader swap for `@nestjs/serve-static`; `graphql/apollo`, the one branch of `@nestjs/apollo`'s own driver that refuses an unknown platform; and `ws`, the `create()` of `@nestjs/platform-ws`'s own `WsAdapter`.

A deployment names no import of any of them. The region resolves them: `compat/registry/discover.ts` asks the **application's** tree for each name in `BRIDGE_PACKAGES`, and a package that is installed publishes its `bridge` for the registry to install. Installing the package is what installs the bridge. `registerBridge` is published from the `.` entrypoint too, so a consumer can add one without a package at all.

No bridge names a runtime. The `serve-static` bridge reads files through `transport.serveStatic()` and its SPA fallback through the same call, so a fetch host works exactly as a Bun one does — `test/node-builtins.test.ts` holds that all four trees import no `node:` builtin at all.

A bridge package reaches the adapter only through the published entrypoint. Every name it needs is exported there — `Bridge`, `BridgeTarget`, `Server`, `Transport`, `WebSocketSupport`, `NestContext`, `loadPeer`, `toHonoPath`, `toNestRequest` — so a `#adapter/` import would be the same bridge reaching past the door into the tree behind it. `test/layers.test.ts` holds that as a sixth rule.

The region is covered in [compatibility.md](compatibility.md): what each bridge does, the `init()` seam, what it costs per request (nothing), the hook it refuses, and which platform names still live in a feature rather than here, and why.

## The compatibility face

Names that carry the shape the package published before the transports split:

- `getHttpServer()` is `Server & http.Server`; the Node transport hands back Node's own server with `listen` and `close` adapted in place, keeping `closeAllConnections()` and an `'upgrade'` listener.
- `NestRequest.raw` is `IncomingMessage & Incoming`; `NestRequest.socket` is `IncomingMessage['socket'] & Socket`.
- `NodeEnv` is exported again, as the `HttpBindings` shape `@hono/node-server` attaches, so a handler annotated `Hono<NodeEnv>` keeps its `incoming` and `outgoing` reads. The security hook Nest registers is handed `context.env.outgoing` where the transport provides it.

`@hono/node-server` is a required peer again, and `engines` still names Node: the Node transport answers an `http.Server`, and a deployment that names it runs on Node or Bun.

`ServerAdapterOptions.overrideGlobalObjects` left with the implicit default it configured. The Node transport carries the option and defaults it to `true`, the fastest path and the behavior the implicit Node transport had; a deployment that wants the globals left alone names it `nodeServer({ overrideGlobalObjects: false })`. The replacement is process-wide and not restored, so `test/probe.ts` puts the process's own classes back before every request, and `packages/core/test/isolation.test.ts` holds that a case may serve the plain `new ServerAdapter()` in process without answering for the files beside it.

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

`core/ports/server.ts` is the `Server` port Nest drives: the `'error'` event, `address()`, `listen()` and `close()`. Each transport builds one. `core/ports/transport.ts` is the `Transport` port — how a server is built, a directory is served, a connection is upgraded — and `core/ports/bindings.ts` is what a transport attaches to each request: the request carrier Nest's SSE path reads, and, where the runtime has one, the native server.

`AbstractHttpAdapter` comes from `@nestjs/core`; the other two are ours, one cohesive unit, since splitting them would have a class extend something the layer rule forbids reaching.

## Reading and writing

`core/request/request.ts` turns a Hono request into the object Nest reads; `core/response/response.ts` turns a value Nest returned into a Web `Response`. They share only the type `NestContext`. `node:stream` is used only by the response half (the `StreamableFile`), so the request half does not import it. The request half still reads `context.env.incoming` to fill in `raw`, `socket` and `ip`, so it depends on the transport bindings: the Node path gets the Node `IncomingMessage` and its real socket; the Bun path synthesizes the carrier and socket, which reports the address Bun gives back.

Every capability reaches the bridge through a seam, installed as an argument, not imported — `handler-bridge.ts` does not know event streams exist. The event stream surface (the writable Nest pipes frames into, with `write`, `setHeader`, `getHeaders`) is installed on the first read of `raw`, not on every request: that read distinguishes an event stream, and Nest makes it only on its SSE path, so an ordinary route keeps Hono's context API on the `@Res()` object.

## Errors

One funnel: `server-adapter.ts` registers `createExceptionRunner` on the Hono error handler, and everything Nest raises arrives there. The runner does not re-read the body, because the failure may be that reading it failed.

## The runtime surface

The core names no runtime; the builtin surface is what Nest and the features need wherever they run. Eight builtins are in use: `node:buffer`, `node:events`, `node:fs/promises`, `node:http`, `node:https`, `node:path`, `node:stream` and `node:util`. Nest's SSE path is a `node:stream` `Writable`; views read the filesystem with `node:fs/promises` and `node:path`; the Node transport builds an `http.Server` with `node:https` for TLS. Static assets are not on the list: `features/static-assets/index.ts` imports no builtin and leaves reading to the transport's `serveStatic()`, and neither the compatibility region nor a bridge package imports one, which is what lets `@ailura/nestjs-platform-hono-serve-static` answer `@nestjs/serve-static` on a fetch host that has no filesystem. `test/node-builtins.test.ts` freezes the set and scans all three trees; adding one is a deliberate edit to both the source and the freeze.

The upload package is outside that scan and reaches four builtins the core does not: `node:crypto`, `node:fs`, `node:os` and `node:stream/promises`. Its disk storage picks a random name with `node:crypto` and a directory with `node:os`, then names the file with `node:path` and reads and writes it with `node:fs`, `node:fs/promises` and `node:stream/promises` — `node:path` and `node:fs/promises` are already on the core's list.

Type-only imports count toward the frozen set. The builtins are reached from more than the transports: `core/` takes `node:buffer`, `node:events` and `node:stream` as values and `node:http` as types, the CORS bridge takes `node:util`, and views take the filesystem ones. Only a transport **builds** a server: `servers/node.ts` is the only module that calls `node:https`, and every other `node:http` import in the core's source is a type.

## The bundle budget

Each package holds its own `.size-limit.json` beside its `package.json`: `packages/core` carries the four adapter entrypoints; `packages/ws`, `packages/socket-io`, `packages/multipart`, `packages/graphql` and `packages/serve-static` their single one, each with a package-relative path. `size-limit` measures an entrypoint as a consumer sees it: bundled, minified, brotlied, peers external. The root `size` script builds then runs `bun run --filter './packages/*' size`; `bun run check` runs it last, and CI runs it as its own job. The historical baseline behind issue #66 is in [bundle-baseline.md](bundle-baseline.md); the current measured values are below.

The ceilings are ratchets: growth past one fails, and moving one is an explicit edit justified here. Current ceiling/measured: `index` 16000/13078, `bun-server` 1125/1109, `node-server` 560/534, `fetch` 500/495, `multipart` 4300/4259, `ws` 1150/1103, `socket-io` 900/873, `graphql` 1900/1850 and `serve-static` 1850/1823. They sit above the baseline page's numbers: the multipart island, signature breadth, the instrumentation hooks, the streaming upload seam, `inject()`, application settings and the subscriptions glue are what raised them. Entry names: `index`, `bun-server`, `node-server` and `fetch` measure `packages/core/dist`, and the other five their own `packages/<name>/dist`. The upload island's streaming seam closes three pieces the reconnaissance in [parity.md](parity.md#file-uploads) calls missing.

Two consequences before you write code:

- **Extracting a helper costs bytes.** The bundler does not inline module-level `function` declarations. Moving code is free; pulling it apart is not.
- **Import order is not free either.** The order of the import statements in `core/server/server-adapter.ts` and `core/server/hono-lifecycle.ts` is load-bearing for the measurement. Alphabetising them costs five bytes. Leave them.

If a change genuinely needs more room, say so in the change rather than quietly raising the ceiling. The budget is the product. See [bundle-baseline.md](bundle-baseline.md) for the measured baseline.

## Where the guards live

| File | What it holds |
| --- | --- |
| `test/layers.test.ts` | the six dependency rules |
| `test/entry-points.test.ts` | subpath isolation, declarations |
| `test/node-builtins.test.ts` | the frozen builtin set, and that a bridge names none |
| `packages/core/test/types/application-surface.ts` | the types a consumer reads through |
| `packages/core/test/types/route-adapter-compat.ts` | the members two Nest versions share |
| `.oxlintrc.json` | rule exceptions, each with a reason |

The root `test/` holds only what guards the monorepo and what more than one package shares: the guards above and the shared probe and helpers (`test/probe.ts`, `test/bun-adapter.ts`, `test/bun-bindings.ts`), reached as `#test/probe.ts`, `#test/bun-adapter.ts` and so on. Each package's behaviour tests live in its own `packages/<name>/test/` with its own `test` script.

`.oxlintrc.json` takes the widest exceptions over `packages/multipart/src/**`, because the island mirrors multer's semantics and `append-field`'s port: multer's `_handleFile` / `_removeFile` names and `Error | null` callbacks, and a request-shaped parser with more parameters and statements per function than the house style allows. Type-safety rules stay on elsewhere, and a rule is relaxed for one file rather than the region — also why `FileStreamInterceptor` sits in `interceptors/file.interceptor.ts` beside the buffered one.

`test/**` and `packages/*/test/**` carry a 700-line ceiling rather than 400, because an end-to-end suite holds its fixtures, gateways and cases in one file. A feature splits across its own files, which rule 2 permits: it forbids reaching into _another_ feature, not into itself. `features/cors/` is `middleware/`, `origins/`, `options.ts` and `types.ts` behind a two-line `index.ts`. Its analogues are larger — `express-adapter.ts` 710 lines, `fastify-adapter.ts` 1,433.

The `.oxlintrc.json` exceptions that are not about `multipart` are on `compat/`:

- `compat/express/middleware-fit.ts` relaxes `typescript/no-unsafe-type-assertion`. It replaces `hono.use` with a shim over `unknown[]`, because Hono's own `use` is a pair of overloads and the shim has to accept both plus the four-argument error middleware.
- `compat/**/*.ts` caps the region at 100 lines, where the repository's own ceiling is 400. The region is small on purpose: every file is one seam, and a comment is at most two lines because the reasoning lives in [compatibility.md](compatibility.md). Two further rules — `max-params` and `only-throw-error` — are disabled inline in the two files that need them, with the reason on the line: the four-parameter Express signature, and rethrowing whatever an error middleware reported.
- `packages/compatibility/test/support.ts` relaxes `typescript/no-unsafe-type-assertion`. Its optional-package loader imports by a specifier the compiler cannot resolve, so a Nest major a package does not support skips rather than fails to load; the assertion is the one seam that hands the loaded module a shape.

`packages/serve-static/` is split along its seams: `peer-load.ts` and `peer-read.ts` (the optional peers), `peer-shapes.ts` (their types), `swap.ts` (the prototype patch), `exclude.ts`, `global-prefix.ts`, `mount-roots.ts` and `mount-type.ts`, `index-file-read.ts` and `index-file-answer.ts` (the SPA fallback), and `loader{,-resolve,-mount,-fallback}.ts` tying them to an adapter. The split is what keeps the third-party typing in `peer-shapes.ts` instead of behind forty lint exceptions on one file. The 100-line cap and the two-line comment rule the region carries apply to each bridge package's `src/` as well.

The Bun transport is split along its seam: `servers/bun-runtime.ts` holds Bun's server and TLS option types, the TLS mapping, and the static-file middleware reading `Bun.file`; `servers/bun.ts` keeps the `hono/bun` websocket helper and the transport factory — the helper installs on the server the factory builds, and the factory serves through that class's fetch handler — and `servers/bun/` holds the class itself, the listen arguments, the fetch bindings, the serve options and the TLS mapping it reads.
