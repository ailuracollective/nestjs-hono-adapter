# Bundle and package baseline

The verified measurements behind issue #66, taken at commit
`f4f2531` on 2026-10-08 and re-measured after the Bun transport
migration. This page is the baseline later changes are compared
against: it records what was measured, how, and what the
evidence supports. It does not propose the implementation.

The zero-configuration bootstrap serves through Bun's own
server, so `index` carries the Bun transport instead of the Node
one. The gate reads: `index` 11944 B, `bun-server` 1003 B,
`node-server` 506 B, `fetch` 496 B, `multipart` 4200 B, `ws`
1543 B and `socket-io` 948 B; the ceilings are 12000 B, 1024 B,
560 B, 500 B, 4250 B, 1550 B and 950 B. `index` moved from 11530
B for the transport it now carries by default and the
conditional `hono/bun` resolution that keeps the module loadable
on Node, `bun-server` from 981 B for the same conditional
import, and the capability packages are unchanged. The
per-feature deltas and the package contents below were taken
before the Bun transport rewrite and have not been re-measured —
they remain the comparison for the code structure they describe.

> **Update after this baseline.** The upload island
> (`./multipart`) was added later. It carries its own ceiling —
> 3800 B, measured 3580 B — and the multipart seam it needs in
> `index` moved that entry to 8910 B, ceiling 9000 B. Every
> other entrypoint is unchanged from the figures below.

> **Update after that — signature breadth.** The second item of
> the backlog in `docs/parity.md` added the signature forms the
> platform adapters accept: a per-request delegate for
> `enableCors()`, Fastify's single-argument `useStaticAssets()`
> with the root inside its options, and Fastify's options object
> for `setViewEngine()`. Together they cost 483 B in `index`:
> 9271 B before, 9754 B after, against a 9300 B ceiling that
> left 29 B — so the raise is 454 B, the smallest that fits, and
> it is recorded in `docs/architecture.md`. Reading a CORS
> delegate is what makes it the larger half, because the bridge
> has to build the request a delegate is handed. `index` moves
> to 9760 B, 6 B of headroom. Refusing the `create()` options
> this adapter cannot serve, rather than dropping them, cost 11
> B in `ws` and moved no ceiling: 1543 B inside its unchanged
> 1550 B. `bun-server`, `node-server`, `fetch` and `multipart`
> are untouched.

> **Update after that.** The instrumentation hooks
> (`setOnRequestHook()` / `setOnResponseHook()`) were added
> later, in the step `features/front-steps.ts` builds and
> `core/hono-lifecycle.ts` mounts. They cost 229 B in `index`:
> 8950 B before, 9179 B after, against a 9000 B ceiling that
> left 50 B. The ceiling is a ratchet and the raise is recorded
> rather than hidden — `index` moved to 9250 B, 71 B of
> headroom. No other entrypoint moved.

> **Update after that — the streaming upload seam.** The first
> item of the backlog in `docs/parity.md` added the streaming
> form of the upload interceptor: `FileStreamInterceptor`, the
> `processStream()` the parser gains beside
> `processMultipart()`, and the `MultipartFileStream` it hands
> over. All of it lands in the upload island, and `multipart`
> grew 553 B with it: 3653 B before, 4206 B after, against a
> 3800 B ceiling that left 147 B.
>
> The raise is 450 B, to 4250 B, and it is recorded in
> `docs/architecture.md`; the island carries the seam and
> nothing else does. Reading the body rather than cancelling it
> — the discard that lets a client finish uploading — and
> keeping the parts that follow the one being taken out of
> `req.body` are the two halves of it, with the file-size limit
> moved onto the stream, which is what the handler can act on.
> Every other entrypoint is untouched: `index` 9754 B,
> `bun-server` 981 B, `node-server` 511 B, `fetch` 418 B and
> `ws` 1543 B, each inside its unchanged ceiling.

> **Update after that — `inject()`.** The second item of the
> backlog in `docs/parity.md` added Fastify's in-process request
> helper. It costs 1073 B in `index`: 9754 B before, 10827 B
> after, against a 9760 B ceiling that left 6 B, so the raise is
> 1120 B, to 10880 B, and it is recorded in
> `docs/architecture.md`. Both call forms, the request options
> light-my-request declares, the refusal of the four it cannot
> honour and the whole answer shape are what the bytes buy; the
> two modules it splits into hold no runtime dependency the
> bundle did not already carry, because `node:buffer` and
> `node:stream` arrive with the body and response encoders.
> Every other entrypoint is untouched: `bun-server` 981 B,
> `node-server` 511 B, `fetch` 418 B, `multipart` 4206 B and
> `ws` 1543 B, each inside its unchanged ceiling.

> **Update after that — `./socket-io`.** The last item of the
> backlog in `docs/parity.md` added the socket.io island: the
> `HonoIoAdapter` behind a seventh subpath, and the refusal that
> names the transport to serve through when socket.io cannot
> attach to the server a transport answered with. It is a new
> entrypoint rather than a raise, so its ceiling is set here
> rather than moved: 950 B, measured at 916 B, which leaves the
> 34 B of headroom the other entries keep between `ws`'s 10 B
> and `fetch`'s 62 B. Nothing in it is charged to `index`,
> because `./socket-io` is reached only by a deployment that
> names it, and `socket.io` is an optional peer the gate leaves
> out of the measurement the way it leaves out `@hono/node-ws`.
> The `index` figure reads 10856 B where the entry above
> recorded 10827 B: nothing in this change reaches that bundle,
> so the refinement merged after it is what grew it. Every other
> entrypoint is untouched: `index` 10856 B, `bun-server` 981 B,
> `node-server` 511 B, `fetch` 418 B, `multipart` 4206 B and
> `ws` 1543 B, each inside its unchanged ceiling.

> **Update after that — application settings.** `setLocal()`,
> `set()`, `enable()` and `disable()` add the last piece of
> Express's application surface this adapter can carry: a local
> written after the application starts reaches every render
> through the context `ViewOptions.defaultContext` already
> fills, and the two settings that name behaviour (`view engine`
> and `views`) delegate to `setViewEngine()` and
> `setBaseViewsDir()`, while every other name is refused with a
> reason rather than stored. It costs 206 B in `index`: 10856 B
> before, 11062 B after, against the 10880 B ceiling that left
> 24 B, so the raise is 210 B, to 11090 B, and it is recorded in
> `docs/architecture.md`. The refusal reasons are 74 B of the
> cost, measured by dropping the map, and 19 B of those are the
> explanatory half of the `trust proxy` reason. Every other
> entrypoint keeps its measured value and its ceiling:
> `bun-server` 981 B, `node-server` 506 B, `fetch` 418 B,
> `multipart` 4206 B, `ws` 1543 B and `socket-io` 948 B.
> (`node-server` reads 506 B where the entry above recorded 511
> B; nothing in this change reaches that entrypoint, so the
> refinement merged after it is what moved it.)

## Environment

| Tool                                  | Version                     |
| ------------------------------------- | --------------------------- |
| Bun                                   | 1.4.2                       |
| Node                                  | 26.10.0                     |
| npm                                   | (bundled with Node 26.10.0) |
| size-limit                            | 14.2.0                      |
| rolldown (via `@size-limit/rolldown`) | 1.2.12                      |

## How to reproduce

```sh
bun install --frozen-lockfile
bun run build
bun run size
```

`bun run size` runs the build and then `size-limit` in each
package, which bundles each entrypoint with rolldown (minified,
tree-shaken, peers external) and brotli-compresses the result.
For the exact byte counts rather than the rounded `kB` display:

```sh
bunx size-limit --debug   # run from the package directory
```

Published contents:

```sh
npm pack --dry-run
```

## The size gate baseline

| Entrypoint    | Ceiling | Measured | Headroom                |
| ------------- | ------- | -------- | ----------------------- |
| `index`       | 12000 B | 11944 B  | 56 B (99.5% of ceiling) |
| `bun-server`  | 1024 B  | 1003 B   | 21 B (98.0% of ceiling) |
| `node-server` | 560 B   | 506 B    | 54 B (90.4% of ceiling) |
| `fetch`       | 500 B   | 496 B    | 4 B (99.2% of ceiling)  |
| `multipart`   | 4250 B  | 4200 B   | 50 B (98.8% of ceiling) |
| `ws`          | 1550 B  | 1543 B   | 7 B (99.5% of ceiling)  |
| `socket-io`   | 950 B   | 948 B    | 2 B (99.8% of ceiling)  |

All seven pass today, and the headroom is thin on several of
them — `socket-io` 2 bytes, `fetch` 4, `ws` 7 — which is what
issue #66 was about. The `node-server` ceiling was lowered from
720 B to 560 B with the transport split, so the win is recorded
rather than absorbed.

## Published package contents

`npm pack` at this commit: **112.1 kB packed, 459.4 kB unpacked,
148 files**.

| Contents           | Bytes   | Files | Share of unpacked |
| ------------------ | ------- | ----- | ----------------- |
| `src/`             | 156,248 | 29    | 34%               |
| `dist/`            | 291,698 | 116   | 63%               |
| — of which `.map`  | 111,083 | 58    | 24%               |
| — of which `.d.ts` | 58,000  | 29    | 13%               |

`files` in `package.json` ships both `dist` and `src`. The
`.js.map` files reference `../src/*.ts` and do not inline the
sources, so `src/` is what makes the shipped sourcemaps resolve;
dropping it would break them.

## The import graph

Method: a static walk of the relative `import`/`export from`
specifiers from each entrypoint, separating **value** imports
(shipped in the bundle) from **type-only** imports (erased at
compile time, zero bundle cost).

**The `ws` entrypoint is already isolated.** By value imports it
reaches exactly four modules: `ws/index.ts`, `ws/adapter.ts`,
`ws/client.ts`, `ws/server.ts`. Its import of `ServerAdapter` is
type-only, so the HTTP adapter is never loaded. There is no
unreachable code in this entrypoint; only its absolute code size
is a concern.

**The `index` entrypoint reaches 24 modules by value imports** —
the whole of `core/` plus all five `features/` modules. The path
runs through the composition root:

| Feature                       | Value-imported by        | Used                                           | Wiring                     |
| ----------------------------- | ------------------------ | ---------------------------------------------- | -------------------------- |
| `features/cors-middleware.ts` | `core/hono-lifecycle.ts` | `installGuards()`, called from the constructor | unconditional              |
| `features/front-steps.ts`     | `core/hono-lifecycle.ts` | `installGuards()`, called from the constructor | unconditional              |
| `features/sse.ts`             | `core/hono-lifecycle.ts` | class field initializer                        | unconditional              |
| `features/views.ts`           | `core/server-adapter.ts` | `new ViewRenderer(...)` in the constructor     | unconditional              |
| `features/static-assets.ts`   | `core/server-adapter.ts` | inside a setup method                          | opt-in call, static import |

So "optional at runtime" holds for behavior, not for the bundle:
a consumer that never enables CORS, SSE, views, or static assets
still ships all five modules.

## Feature code in the index bundle

Measured by replacing one feature module at a time with a no-op
stub in a scratch copy (the repository was not modified), then
building and brotli-compressing with the size-limit
configuration. Baseline in this replication: 8446 B
(size-limit's own figure: 8444 B).

| Measurement                  | Size   | Delta   |
| ---------------------------- | ------ | ------- |
| baseline                     | 8446 B | —       |
| `cors-middleware.ts` stubbed | 7999 B | −447 B  |
| `front-steps.ts` stubbed     | 8344 B | −102 B  |
| `sse.ts` stubbed             | 7511 B | −935 B  |
| `static-assets.ts` stubbed   | 7954 B | −492 B  |
| `views.ts` stubbed           | 8128 B | −318 B  |
| all five stubbed             | 6089 B | −2357 B |

The five feature modules contribute about 2.36 kB — roughly 28%
of the `index` bundle. `sse.ts` is the largest single
contributor.

## Candidates, ranked by evidence

1. **Lazy-load the five feature modules.** Convert the static
   imports in `core/hono-lifecycle.ts` and
   `core/server-adapter.ts` to dynamic imports at the call
   sites. Evidence: the stub deltas above — up to ~2.36 kB off
   the `index` entry (to ~6.1 kB), restoring headroom from 56 B
   to ~2.4 kB. Risk: medium. Three of the five use sites are
   unconditional constructor paths (a field initializer, a
   constructor call, and `installGuards`), so they need
   lazy-init patterns rather than a one-line import change.
   Behavior must not change; the existing suites cover CORS,
   guards, SSE, views, and static assets.
2. **Published package contents.** `src/` is 34% of the unpacked
   package and `.map` files are 24%. Options: drop `src/`
   (breaks the shipped sourcemaps), drop the `.d.ts.map` files
   (only useful when `src/` is present), or inline
   `sourcesContent` in the `.js.map` files (grows `dist/`). This
   affects download size, not the size gate, and is a product
   decision rather than bundle-gate work.
3. **Examined and dismissed.** The `hono` root import in
   `core/hono-lifecycle.ts` — `hono` is external to the gate,
   and the root is the standard Hono 4 entry. The `ws`
   entrypoint — no unreachable code by value imports; only
   absolute code size.

## The #68 investigation: measured outcomes

Issue #68 asked for a measured reduction in the entry points.
Each candidate above was implemented in a scratch copy and
measured against the size-limit configuration. None survives
contact with the gate.

**Lazy-loading the features breaks the gate.** Converting the
five static feature imports to dynamic imports at their call
sites:

| Scenario               | Entry chunk | All chunks (what the gate measures) |
| ---------------------- | ----------- | ----------------------------------- |
| baseline               | 8446 B      | 8446 B                              |
| `front-steps` lazy     | 8373 B      | 8619 B                              |
| all five features lazy | 5713 B      | 10180 B                             |

The entry chunk shrinks — by 2.7 kB when all five are lazy — but
the total always grows past the 8500 B ceiling. A feature
minified as a separate async chunk is larger than its inline
contribution (separate minification, chunk boilerplate, and
shared modules split into their own chunks). Even the smallest
feature costs +173 B net. The gate counts every output chunk, so
no amount of feature lazy-loading is compatible with it.

**Merging single-importer modules saves nothing.** The
architecture doc notes that extracting a helper costs bytes. The
three single-importer modules (`path.ts` into
`server-adapter.ts`, `params.ts` into `request.ts`,
`response-helpers.ts` into `handler-bridge.ts`) were merged and
measured: 8444 B against the 8446 B baseline. The minifier
already inlines cross-module calls, so the module boundaries
cost no measurable bytes.

**No dead code exists to remove.** Every core module is
exercised per request; every `ws-island` export is consumed. The
only code that is not always needed is the opt-in feature and
versioning code, and the only mechanism that removes it from the
entry chunk (dynamic imports) breaks the gate.

**Conclusion.** The `index` bundle is at its minifiable floor
for this code structure. A reduction would require removing
documented functionality (a non-goal) or rewriting already-tight
logic against the adapter contract. No safe material reduction
is available; this is the outcome issue #68 allows documenting.

## Constraints on any change

- The import order in `core/server-adapter.ts` and
  `core/hono-lifecycle.ts` is load-bearing for the measurement
  (see _The bundle budget_ in `docs/architecture.md`).
- The ceilings in each package's `.size-limit.json` are
  ratchets. Lowering one is an allowed edit; it is recorded
  here, not hidden.
- HTTP, WebSocket, lifecycle, middleware, query parsing, SSE,
  and security-sensitive behavior must remain compatible.

## Limitations

- Stub deltas keep the call-site wrappers in the entry chunk.
  Real lazy-loading replaces call sites with async wrappers, so
  the true entry-chunk savings may differ slightly; the order of
  magnitude is what the table supports.
- A from-scratch rolldown replication of the size-limit
  configuration differs from size-limit's own measurement by 1–2
  bytes. `bunx size-limit --debug` from a package directory is
  authoritative.
- Measurements are from commit `f4f2531` under Bun 1.4.2 and
  Node 26.10.0. Re-run the commands above to compare after any
  change.
