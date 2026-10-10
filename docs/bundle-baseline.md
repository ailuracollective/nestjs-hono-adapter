# Bundle and package baseline

The verified measurements behind issue #66, taken at commit
`f4f2531` on 2026-10-08 and re-measured after the Bun transport
migration. This page is the baseline later changes are compared
against: it records what was measured, how, and what the
evidence supports. It does not propose the implementation.

The transport split moved the measurements, and making the Node
transport the default moved `index` back up: `index` 8804 B,
`bun-server` 981 B, `node-server` 511 B, `fetch` 437 B and `ws`
1368 B; the ceilings are 8900 B, 1024 B, 560 B, 480 B and 1400
B. The two raises are deliberate and are the price of the
default: `index` carries the Node transport again (+380 B
against the 8424 B of the split) because `new ServerAdapter()`
has to keep serving, and `ws` carries the `@hono/node-ws`
fallback the transport no longer does (+112 B). `node-server`
fell by 176 B, because Node's own `http.Server` is what it hands
back now instead of a wrapper around it. The per-feature deltas
and the package contents below were taken before the Bun
transport rewrite and have not been re-measured — they remain
the comparison for the code structure they describe.

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

`bun run size` runs the build and then `size-limit`, which
bundles each entrypoint with rolldown (minified, tree-shaken,
peers external) and brotli-compresses the result. For the exact
byte counts rather than the rounded `kB` display:

```sh
bunx size-limit --debug
```

Published contents:

```sh
npm pack --dry-run
```

## The size gate baseline

| Entrypoint    | Ceiling | Measured | Headroom                |
| ------------- | ------- | -------- | ----------------------- |
| `index`       | 8900 B  | 8804 B   | 96 B (98.9% of ceiling) |
| `bun-server`  | 1024 B  | 981 B    | 43 B (95.8% of ceiling) |
| `node-server` | 560 B   | 511 B    | 49 B (91.3% of ceiling) |
| `fetch`       | 480 B   | 437 B    | 54 B (88.8% of ceiling) |
| `ws`          | 1400 B  | 1368 B   | 32 B (97.7% of ceiling) |

All five pass today, and the headroom is still thin on `index`
and `ws` — 96 and 32 bytes — which is the premise of issue #66.
The `node-server` ceiling was lowered from 720 B to 560 B in the
same edit, so the win is recorded rather than absorbed.

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
| `features/guard-bridge.ts`    | `core/hono-lifecycle.ts` | `installGuards()`, called from the constructor | unconditional              |
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
| `guard-bridge.ts` stubbed    | 8344 B | −102 B  |
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
| `guard-bridge` lazy    | 8373 B      | 8619 B                              |
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
- The ceilings in `.size-limit.json` are ratchets. Lowering one
  is an allowed edit; it is recorded here, not hidden.
- HTTP, WebSocket, lifecycle, middleware, query parsing, SSE,
  and security-sensitive behavior must remain compatible.

## Limitations

- Stub deltas keep the call-site wrappers in the entry chunk.
  Real lazy-loading replaces call sites with async wrappers, so
  the true entry-chunk savings may differ slightly; the order of
  magnitude is what the table supports.
- A from-scratch rolldown replication of the size-limit
  configuration differs from size-limit's own measurement by 1–2
  bytes. `bunx size-limit --debug` is authoritative.
- Measurements are from commit `f4f2531` under Bun 1.4.2 and
  Node 26.10.0. Re-run the commands above to compare after any
  change.
