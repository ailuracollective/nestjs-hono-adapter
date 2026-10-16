# Bundle and package baseline

The verified measurements behind issue #66, taken at commit `f4f2531` on 2026-10-08 and re-measured after the Bun transport migration. The zero-configuration bootstrap serves through Bun's own server, so `index` carries the Bun transport instead of the Node one; the capability packages are unchanged. The per-feature deltas and package contents below predate the Bun rewrite and have not been re-measured. Later changes — the multipart and socket.io islands, signature breadth, instrumentation hooks, the streaming upload seam, `inject()`, application settings and the WebSocket island split — raise the ceilings recorded in `docs/architecture.md`. This page is the baseline later changes are compared against.

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

`bun run size` runs the build and then `size-limit` in each package, which bundles each entrypoint with rolldown (minified, tree-shaken, peers external) and brotli-compresses the result. For the exact byte counts rather than the rounded `kB` display:

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
| `ws`          | 1650 B  | 1618 B   | 32 B (98.1% of ceiling) |
| `socket-io`   | 950 B   | 948 B    | 2 B (99.8% of ceiling)  |

All seven pass, with thin headroom on several — `socket-io` 2 B and `fetch` 4 B — which is what issue #66 was about. The `node-server` ceiling was lowered from 720 B to 560 B with the transport split.

## Published package contents

`npm pack` at this commit: **112.1 kB packed, 459.4 kB unpacked, 148 files**.

| Contents           | Bytes   | Files | Share of unpacked |
| ------------------ | ------- | ----- | ----------------- |
| `src/`             | 156,248 | 29    | 34%               |
| `dist/`            | 291,698 | 116   | 63%               |
| — of which `.map`  | 111,083 | 58    | 24%               |
| — of which `.d.ts` | 58,000  | 29    | 13%               |

`files` in `package.json` ships both `dist` and `src`. The `.js.map` files reference `../src/*.ts` and do not inline the sources, so `src/` is what makes the shipped sourcemaps resolve.

## The import graph

Method: a static walk of the relative `import`/`export from` specifiers from each entrypoint, separating **value** imports (shipped in the bundle) from **type-only** imports (erased at compile time, zero bundle cost).

**The `ws` entrypoint is already isolated.** By value imports it reaches exactly four modules: `ws/index.ts`, `ws/adapter.ts`, `ws/client.ts`, `ws/server.ts`. Its import of `ServerAdapter` is type-only, so the HTTP adapter is never loaded; only its absolute size is a concern.

**The `index` entrypoint reaches 24 modules by value imports** — the whole of `core/` plus all five `features/` modules, through the composition root:

| Feature | Value-imported by | Used | Wiring |
| --- | --- | --- | --- |
| `features/cors/index.ts` | `core/server/hono-lifecycle.ts` | `installGuards()`, called from the constructor | unconditional |
| `features/front-steps/index.ts` | `core/server/hono-lifecycle.ts` | `installGuards()`, called from the constructor | unconditional |
| `features/sse.ts` | `core/server/hono-lifecycle.ts` | class field initializer | unconditional |
| `features/views/index.ts` | `core/server/server-adapter.ts` | `new ViewRenderer(...)` in the constructor | unconditional |
| `features/static-assets/index.ts` | `core/server/server-adapter.ts` | inside a setup method | opt-in call, static import |

So "optional at runtime" holds for behavior, not the bundle: a consumer that never enables CORS, SSE, views or static assets still ships all five.

## Feature code in the index bundle

Measured by replacing one feature module at a time with a no-op stub in a scratch copy (the repository was not modified), then building and brotli-compressing with the size-limit configuration. Baseline in this replication: 8446 B (size-limit's own figure: 8444 B).

| Measurement                  | Size   | Delta   |
| ---------------------------- | ------ | ------- |
| baseline                     | 8446 B | —       |
| `cors-middleware.ts` stubbed | 7999 B | −447 B  |
| `front-steps.ts` stubbed     | 8344 B | −102 B  |
| `sse.ts` stubbed             | 7511 B | −935 B  |
| `static-assets.ts` stubbed   | 7954 B | −492 B  |
| `views.ts` stubbed           | 8128 B | −318 B  |
| all five stubbed             | 6089 B | −2357 B |

The five feature modules contribute about 2.36 kB — roughly 28% of `index`. `sse.ts` is the largest single contributor.

## Candidates, ranked by evidence

1. **Lazy-load the five feature modules.** Converting the static imports in `core/server/hono-lifecycle.ts` and `core/server/server-adapter.ts` to dynamic imports at the call sites could take up to ~2.36 kB off `index` (to ~6.1 kB), restoring headroom from 56 B to ~2.4 kB. But three of the five use sites are unconditional constructor paths (a field initializer, a constructor call and `installGuards`), so it needs lazy-init patterns, not a one-line import change — and it fails the gate (below).
2. **Published package contents.** `src/` is 34% of the unpacked package and `.map` files 24%. Dropping either (or inlining `sourcesContent`) affects download size, not the size gate; it is a product decision, not bundle-gate work.
3. **Examined and dismissed.** The `hono` root import in `core/server/hono-lifecycle.ts` — `hono` is external to the gate, and the root is the standard Hono 4 entry. The `ws` entrypoint — no unreachable code by value imports.

## The #68 investigation: measured outcomes

Issue #68 asked for a measured reduction in the entry points. Each candidate was implemented in a scratch copy and measured against the size-limit configuration; none survives contact with the gate.

**Lazy-loading the features breaks the gate.** Converting the five static feature imports to dynamic imports shrinks the entry chunk (5713 B with all five lazy) but grows the total the gate counts to 10180 B, past the 8500 B ceiling: a feature minified as a separate async chunk is larger than its inline contribution, and even the smallest feature nets +173 B. **Merging single-importer modules saves nothing.** Merging `path.ts` into `server-adapter.ts`, `params.ts` into `request.ts` and `response-helpers.ts` into `handler-bridge.ts` measured 8444 B against the 8446 B baseline, because the minifier already inlines cross-module calls. **No dead code exists to remove:** every core module is exercised per request and every `ws-island` export is consumed; the only code not always needed is the opt-in feature and versioning code, and the only mechanism that removes it (dynamic imports) breaks the gate. **Conclusion:** `index` is at its minifiable floor for this structure; a reduction would require removing documented functionality or rewriting already-tight logic against the adapter contract, so issue #68 documents no safe material reduction.

## Constraints on any change

- The import order in `core/server/server-adapter.ts` and `core/server/hono-lifecycle.ts` is load-bearing for the measurement (see _The bundle budget_ in `docs/architecture.md`).
- The ceilings in each package's `.size-limit.json` are ratchets. Lowering one is an allowed edit; it is recorded, not hidden.
- HTTP, WebSocket, lifecycle, middleware, query parsing, SSE and security-sensitive behavior must remain compatible.

## Limitations

- Stub deltas keep the call-site wrappers in the entry chunk. Real lazy-loading replaces them with async wrappers, so the true entry-chunk savings may differ; the order of magnitude is what the table supports.
- A from-scratch rolldown replication differs from size-limit's own measurement by 1–2 bytes. `bunx size-limit --debug` from a package directory is authoritative.
- Measurements are from commit `f4f2531` under Bun 1.4.2 and Node 26.10.0; re-run the commands above to compare after any change.
