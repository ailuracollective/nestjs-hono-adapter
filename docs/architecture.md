# Architecture

This is the map a contributor needs before changing a file. The
README describes what the adapter does; this describes the shape
it is built in, and which shapes are refused.

## The three regions of `src/`

```
src/
  index.ts  ws.ts                        the two public entrypoints
  ws-adapter.ts  ws-client.ts  ws-server.ts   the WebSocket island
  core/     the Nest <-> Hono translation
  features/ the optional capabilities
```

**`core/`** holds the translation and the adapter chain, plus
the primitives that translation needs. It is the only region
that knows both Nest's contract and Hono's objects.

**`features/`** holds the capabilities a deployment may or may
not turn on: CORS, event streams, static assets, views. They are
separate because each one is optional at runtime, and because
none of them should be able to reach sideways into another.

**The WebSocket island** is separate from both. It is the reason
the package publishes a second entrypoint at all.

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

Rule 4 is the load-bearing one. `src/ws-adapter.ts` does import
`ServerAdapter`, and it does so with `import type`. That is
erased at compile time, so the `/ws` subpath never loads the
HTTP adapter. The moment that becomes a value import, a
deployment that only serves HTTP pays for a WebSocket stack.

## Entrypoints and isolation

The `exports` map in `package.json` exposes exactly two
specifiers: `.` and `./ws`. It exposes nothing else, so no
consumer can reach an internal module by path — which is what
makes it safe to move files between regions without it being a
breaking change.

`test/entry-points.test.ts` walks the import graph transitively
from both entrypoints and fails if the HTTP one reaches
`@hono/node-ws`, `@nestjs/websockets` or `ws`. Those are
optional peer dependencies: a deployment that serves HTTP must
not need them installed.

Note the deliberate difference between the two guards.
`entry-points.test.ts` counts a type-only import as an edge;
`layers.test.ts` distinguishes them. That is on purpose. The
entrypoint guard wants to be conservative — if a type import
ever becomes a value import, it should catch it early. The layer
guard has to be precise, because rule 4 is exactly about that
difference.

## The adapter chain

Three modules, each extending the one before:

```
RouteAdapter  (core/route-adapter.ts)  extends AbstractHttpAdapter
  HonoLifecycle (core/hono-lifecycle.ts)  adds the Hono app, the
                                          middleware and the Node server
    ServerAdapter (core/server-adapter.ts)  implements the rest of
                                            the Nest contract
```

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
`core/request.ts` still reads `context.env.incoming` — the Node
request `@hono/node-server` attaches to every request — to fill
in `raw`, `socket` and `ip`. So the decode half needs the Node
bindings: this is a Node adapter, not a portable one. The split
removed a Node import, not the Node dependency.

The suite reflects that honestly. `test/probe.ts` passes a
synthetic `incoming` binding so most cases can run in process
with no socket, and the handful that need a real one — TLS,
shutdown, the WebSocket upgrade — keep it.

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

## The Node surface

The adapter is not runtime-neutral and does not claim to be.
`docs/lint-exceptions.md` states "the platform is Node", and the
Cloudflare example enables `enable_nodejs_http_server_modules`.

Eight builtins are in use: `node:buffer`, `node:events`,
`node:fs/promises`, `node:http`, `node:https`, `node:path`,
`node:stream` and `node:util`. `test/node-builtins.test.ts`
freezes that set. Adding one is allowed, but it means also
deciding that the Wrangler compatibility flags still cover it —
so the test failing is the signal to update both deliberately,
not an obstacle to route around.

Type-only imports count toward the frozen set, because a
type-only import still couples a module's types to the platform.

## The bundle budget

`.size-limit.json` holds a ceiling per entrypoint, measured by
`size-limit` as a consumer would see it: bundled, minified,
brotlied, with peers external. `pnpm run check` runs it last,
and CI runs it again as its own job.

The ceilings are ratchets. Growth past one fails, and moving one
is an explicit edit that has to be justified here. `index` sits
at 7250 bytes against a measurement of 7101, and it is the one
that has moved: two correctness fixes — the lazy `@Sse()`
surface, because an ordinary `@Res()` route was answered as an
event stream, and the null-body status, where a `@HttpCode(204)`
handler returning a value was answered `500` — cost 101 bytes,
and the query refactor and the zero-byte removals beside them
paid 75 of that back. The net is +26 for the fixes rather than
+101. `ws` is still on its own measurement.

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

| File                         | What it holds                       |
| ---------------------------- | ----------------------------------- |
| `test/layers.test.ts`        | the four dependency rules           |
| `test/entry-points.test.ts`  | subpath isolation                   |
| `test/node-builtins.test.ts` | the frozen Node set                 |
| `.oxlintrc.json`             | rule exceptions, each with a reason |

When a lint exception is added, `docs/lint-exceptions.md`
records why. That file is the reason the configuration is
readable at all: it is a copy from a parent repository, and
without the written reasons there is no telling which of its
rules are deliberate and which are inherited by accident.
