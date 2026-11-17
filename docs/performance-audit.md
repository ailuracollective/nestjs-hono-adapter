# HTTP hot-path performance audit

## Scope and isolation

The adapter translates Nest requests and replies to Hono without replacing Nest's execution pipeline. The initial audit assumes one server process, keep-alive HTTP/1.1 traffic and 50 concurrent connections; the Node follow-up uses 100 connections. Neither represents a multi-worker production deployment.

The starting point is the published head of Inertia PR #253, off the then-current `main`; PR #256 concerns peer declarations. The primary checkout contains overlapping, uncommitted performance and Inertia work, which is neither copied nor changed. This audit lives on `siddharthagf/perf/audit-http-hot-path` in the separate `nestjs-hono-perf-audit` worktree. It is based on the Inertia branch, not directly on main.

The request path inspected is transport bindings → Hono front steps/CORS/security → request bag and body reader → middleware/route bridge → Nest handler → response writer/builders → Hono response → transport. The review also follows the Express response proxy, deferred middleware continuations, optional bridge discovery, SSE commitment/disconnect handling, query/parameter decoding and binary/stream conversion.

No production dependencies, public exports, bundle ceilings, transport defaults or prototype-wide patches are added. The seven response helper bindings remain: extracted helpers must retain their context, and invoking one must finalise a middleware response.

**Retained:** the static CORS scheduling change, followed by the native HTTP/1 body-presence gate and shared Express response extras described below. **Discarded:** the shared response-settlement descriptor. The official Nest 11 CI recipe has a separate dependency-alignment problem; its unmodified execution is not reported as green.

## Environment and method

- AMD Ryzen 5 7535HS, 6 physical/12 logical cores, 15 GiB RAM.
- Linux `6.18.33.2-microsoft-standard-WSL2`, x86-64, on a shared development machine.
- Bun 1.4.4, Node 26.13.0, Nest 12.1.3, Hono 4.13.16, oha 1.17.0.
- Frozen workspace install; emitted JavaScript, not a TypeScript loader, serves network requests.
- Targets run sequentially on `127.0.0.1`, with production mode and CORS enabled. There is no CPU affinity, fixed governor, isolated host or hardware-counter measurement.
- The broad screen uses three 2-second measurements after a 1-second warmup. Focused comparisons use five 3-second measurements after a 2-second warmup. Medians and individual samples are retained; these short shared-host runs are not a production capacity certificate.
- The load generator is oha. Server CPU and mean/peak RSS come from the existing 250 ms resource sampler. CPU cost excludes the generator. Latency is end-to-end loopback latency, not handler CPU time.
- Error requests deliberately return 418 and count as HTTP errors. Other scenarios must have zero error responses. Successful load responses alone do not prove protocol parity; regression and compatibility tests supply that evidence.

The original `plaintext` fixture returns JSON. The audit corrects it to `OK` and adds finite streaming, a real `ParseIntPipe` and scoped Nest middleware before establishing the comparison baseline. Old published plaintext numbers are therefore not directly comparable.

An actual header probe also finds unequal initial control settings: Express generates weak ETags and `X-Powered-By`, while Fastify advertises three CORS methods against Hono's seven and omits Hono's max age. The final benchmark alignment disables those Express additions and aligns the official adapters' CORS method/max-age settings. JSON bodies, absent ETags and CORS policy are asserted over HTTP on all four targets. The final broad comparison is rerun after this correction; earlier control results are exploratory, not used as an equivalent ranking.

The Hono options stay `{ origin: '*' }`: their default method list and max age already have the desired values. Supplying an explicit list would add per-request list parsing and invalidate its earlier before/after workload. Residual wire differences such as header whitespace/case, empty preflight content length, `Vary` and transport keep-alive defaults are documented rather than hidden with extra response middleware. This is an application-level comparison, not an isolated routing-instruction benchmark.

The same Nest applications run on the adapter's Bun and Node transports and the official Express and Fastify adapters. Native Hono on Bun is a separate lower-bound reference for text, JSON, simple query, parameters and JSON POST. It has no Nest lifecycle or equivalent body-limit contract. No official `NodeAdapter` is installed or exported by the installed `@nestjs/core`; no extra package is installed merely to create that comparison.

### CPU, allocations and heap

`packages/benchmarks/src/harness/profile.ts` runs the base Nest module through the fetch path, with CORS, 10,000 warmup requests and a finite measured request count. Every response is asserted successful and fully drained. This includes client-side `Request` creation and response draining but excludes the real Bun/Node network transport. Its Node process uses standard Web globals, whereas the network transport retains its existing `overrideGlobalObjects: true` setting in a separate child process. Network throughput comes from the separate load harness.

Clean CPU profiles use 200,000 middleware requests and no heap snapshot. Initial exploratory `/hello` profiles include snapshot creation and are explicitly excluded from hot-path CPU percentages.

The Node allocation sampler uses a 32 KiB interval and includes objects collected by minor and major GC. Sampling includes startup and the 10,000-request warmup as well as 100,000 measured requests. Byte counts are estimates, not exact object counts or retained heap. A CLI `--heap-prof` snapshot of survivors alone would miss most request churn.

Separate Node/V8 and Bun/JSC heap snapshots and Node GC traces are retained locally. A finite workload and a stable post-GC heap do not prove the absence of leaks over hours, open streams or application restarts. No exact Bun allocation-rate figure or long-running leak-free claim is made.

## Confirmed costs and decisions

### 1. Fresh response-settlement closures

`packages/core/src/core/response/response-helpers.ts` creates four function instances, an accessor object and a property descriptor on the first middleware response in every context. Subsequent middleware reuses its promise, but every new request repeats the setup.

The discarded candidate caches the original accessors by prototype and installs a single shared descriptor. Only the promise/resolver and request-local state remain request-specific. The original Hono getter/setter are still invoked with the real context, and settlement still follows a successful assignment. Nothing is written to Hono's prototype.

The five-repeat 500,000-context microbenchmark reuses immutable Request/Response inputs. Median elapsed time falls from 1,582.51 to 225.96 ms on Node and from 265.89 to 214.09 ms on Bun. Its large Node improvement is susceptible to JIT scalar replacement; it is evidence about this seam, not a network speedup.

One allocation sample attributes 54.08 MB to `whenResponseSettled()` before and 8.46 MB with the candidate; total estimated allocations fall only from 4.937 to 4.865 GB. Attribution changes with inlining, so the self-size drop is not an exact object-size reduction.

HTTP results do not justify retention. The combined candidate's Bun Inertia HTML median is 4,552 req/s against 4,824 before (−5.6%); CORS alone recovers to 4,851. Other candidate results are mixed. This does not establish a universal causal regression, but fails the consistent-benefit acceptance rule. The production helper is restored byte-for-byte; the tests and microbenchmark remain. The rejected patch is retained locally at `results/audit/settlement/change.patch` under the benchmark package.

Regression cases cover per-context isolation, idempotent installation, header reads that must not settle, repeated response assignments with multiple cookies, and extracted JSON helpers. The existing deferred-next, Express, SSE, multipart and Inertia suites remain essential.

### 2. Promise-wrapped static CORS settings

`packages/core/src/features/cors/middleware/bridge.ts` awaits `resolveOptions()` and `resolveOrigin()` on every enabled request. With static settings those helpers each construct an already-resolved promise; the two awaits also schedule continuations even though no asynchronous decision exists.

The retained change uses static values directly and keeps both existing awaited resolver paths for callbacks/delegates. It does not cache options, origin results or middleware across requests. A changed configuration is still read again, denied origins still fall through, and callback errors still reach the error handler. The origin property is read once, including when it is a getter. The existing continued-preflight helper owns the continuation rather than adding another await in its caller.

Regression tests exercise asynchronous delegates and origin callbacks together, asynchronous delegate failure, mutable static options, an origin getter and two origin decisions on the same application. Existing tests cover credentials, regular expressions, denied origins, custom preflight status, header reflection and continued preflights.

### Static CORS measurements

Five fresh-process repetitions of 200,000 fully answered preflights follow 10,000 warmup requests. Request inputs are immutable and reused, so these figures isolate CORS rather than network or request-construction cost.

| Runtime | Before median ms | After median ms | Change | Before range ms | After range ms | CPU ms before → after |
| --- | --: | --: | --: | --- | --- | --- |
| Node | 1,122.29 | 954.45 | −15.0% | 1,051.88–1,197.01 | 924.60–976.38 | 1,189.08 → 1,022.80 |
| Bun | 732.10 | 660.00 | −9.8% | 721.77–1,416.63 | 646.77–689.66 | 896.80 → 806.25 |

CPU reductions are 14.0% on Node and 10.1% on Bun. Before/after elapsed ranges do not overlap in these repetitions. This is the reproducible, runtime-local benefit; it is not a claim of a 15% faster Nest application.

The focused HTTP comparison uses identical 50-connection, 2-second-warmup, five-by-3-second settings. Values below are independent medians; latency and CPU cost are milliseconds, RSS is mean resident memory in MiB.

| Target | Scenario | Req/s before → after | Change | p50 | p95 | p99 | CPU/request | RSS |
| --- | --- | --: | --: | --- | --- | --- | --- | --- |
| Bun | JSON | 11,431 → 12,454 | +9.0% | 4.05 → 3.69 | 6.57 → 6.33 | 9.16 → 7.88 | 0.090 → 0.083 | 106.2 → 106.0 |
| Bun | Middleware | 9,901 → 10,110 | +2.1% | 4.57 → 4.47 | 7.83 → 7.67 | 10.24 → 9.87 | 0.105 → 0.103 | 103.0 → 104.3 |
| Bun | Inertia JSON | 4,656 → 4,709 | +1.1% | 9.79 → 9.53 | 14.89 → 14.63 | 21.06 → 20.79 | 0.227 → 0.225 | 117.8 → 118.3 |
| Bun | Inertia HTML | 4,824 → 4,851 | +0.6% | 9.31 → 9.33 | 14.24 → 14.11 | 20.26 → 20.72 | 0.223 → 0.222 | 119.8 → 117.3 |
| Bun | CORS | 13,530 → 13,991 | +3.4% | 3.39 → 3.30 | 5.56 → 5.35 | 7.14 → 7.04 | 0.076 → 0.074 | 100.6 → 102.7 |
| Node | JSON | 6,350 → 6,324 | −0.4% | 6.85 → 6.84 | 13.34 → 13.16 | 18.46 → 19.27 | 0.191 → 0.196 | 702.8 → 685.4 |
| Node | Middleware | 5,953 → 5,871 | −1.4% | 7.38 → 7.46 | 13.09 → 13.55 | 19.24 → 19.15 | 0.209 → 0.211 | 351.6 → 349.5 |
| Node | Inertia JSON | 2,980 → 2,893 | −2.9% | 15.09 → 15.31 | 23.49 → 25.65 | 32.94 → 33.49 | 0.432 → 0.449 | 369.1 → 344.7 |
| Node | Inertia HTML | 3,364 → 3,315 | −1.5% | 13.26 → 13.36 | 20.71 → 21.77 | 29.01 → 29.49 | 0.385 → 0.389 | 344.9 → 344.6 |
| Node | CORS | 9,709 → 9,597 | −1.1% | 4.74 → 4.79 | 7.12 → 7.25 | 9.66 → 10.11 | 0.110 → 0.111 | 350.5 → 348.3 |

Bun's JSON and preflight gains also appear in the earlier combined experiment (+8.2% and +6.5%). No Node HTTP gain is demonstrated: all five before/after per-scenario throughput ranges overlap, and the negative medians are deliberately retained in the table. These runs cannot rule out a small Node regression on an isolated host. The change is retained for the consistent finite CORS CPU/scheduling benefit and repeated Bun network improvement, not on a universal throughput claim.

Total allocation estimates for the complete middleware workload are 4.937 GB before and 4.900 GB with CORS alone (−0.8%, one sample each). That small difference is not treated as a robust whole-application allocation win. The exact structural saving is two explicitly constructed resolved promises and their two await continuations for static CORS settings. No meaningful RSS reduction is claimed; Node's first-scenario RSS demonstrates substantial allocation pressure, not proof of a retained-heap leak.

### 3. Optional compatibility is not free per request

The registry itself installs once, but an installed Inertia bridge mounts `fitSurface()` on every Hono application, including the benchmark's base app without Inertia providers. In the clean finite middleware profile, Inertia `fit()` accounts for 5.16% of Node samples and 1.26% of Bun samples. Express `headerReaders()` accounts for 2.03% and 3.03%, respectively; Bun's `finalizeOnResponse()` accounts for 3.74%. These are sampled self-time shares of this workload, not universal cost ratios.

The response proxy also allocates its readers, local state, closures, overrides and chunk list per middleware hop. Allocation sampling makes this visible. The primary checkout already contains experiments in this area, so the audit does not implement a competing middleware cache or rewrite the optional bridge.

Recommendation: measure a consumer installation without optional bridges, then evaluate per-application activation and a lazy middleware surface against all Inertia scopes, CSRF, sessions, GraphQL uploads and multi-application tests. Removing a surface because a benchmark route does not use it would break the adapter's contract.

### 4. Async coordination is substantial, but not dead code

Allocation samples attribute substantial churn to `settle()`, route continuations and promise races. The route must nevertheless accept a middleware that defers `next()`, answers without calling it, calls it without awaiting, or starts an SSE stream before the handler promise finishes. An unconditional direct-handler shortcut is not valid.

The audit retains those races and failure watchers. A future lazy SSE/continuation experiment must prove all four cases and repeat measurements on Node as well as Bun. Similar experiments are already pending in the primary checkout.

### 5. Nest 11 validation needs coherent benchmark dependencies

The official CI recipe updates core, bridge and compatibility packages to Nest 11 but leaves the benchmark's `>=11 <13` Express/Fastify dependencies resolved at 12.1.3. In the audit's Nest 11.2.10 snapshot this produces TS2769 in `packages/benchmarks/src/harness/server/creators.ts`. The failures concern incompatible adapter types, not the CORS implementation.

Explicitly aligning all four benchmark Nest dependencies to 11 makes typecheck and build pass. The nested snapshot also resolves the three removed Nest-12-only optional peers from its parent's `node_modules`; its four optional cases must therefore be explicitly excluded. All compatible cases pass, including bridge, upload, SSE and CORS cases.

After updating the snapshot with the final comparison-setting fixtures, the repeated run passes 791 tests. The four excluded cases are precisely the three Nest-12-only boot cases and the authentication-guard case, not failures in the supported Nest 11 surface.

Recommendation: the CI owner adds the benchmark's Nest packages to the same-major matrix update, then reruns the normal isolated CI job. This audit does not change `.github/` or claim the unmodified Nest 11 CI recipe is green. The repository's full definition of done remains pending that correction.

### 6. Native HTTP/1 body presence and response extras

The published benchmark report on `main` still describes the 14 October workload, before subsequent HTTP compatibility changes. Repeating that historical frozen tree and current main with the same current tools, 100 connections, a 3-second warmup and three 5-second samples gives Hono/Node JSON medians of 10,921 and 7,499 req/s. Express with its original defaults remains near 9,644 and 9,733 req/s. The inversion therefore predates the Inertia branch; the two frozen trees also differ in Hono, Node adapter and Nest patch versions, so this is not a source-only bisect.

One concrete cause is the GET/HEAD body-presence probe. Reading `context.req.raw.body` makes `@hono/node-server` materialise a native `Request` and abort controller even for an empty GET. An isolated omission of that getter on main reaches 9,400 req/s; additionally omitting the Express response surface reaches 10,466. Those diagnostic bypasses are not retained: a real GET payload and an Express-shaped response must still work.

The production correction checks framing headers and consumed-body state first. Only a native HTTP/1 carrier, identified by both the incoming HTTP version and the outgoing response binding, can omit the Web-body getter. Fetch hosts, synthetic carriers and HTTP/2 retain it. Tests exercise GET/HEAD without materialisation, declared and consumed bodies, unframed Web bodies, and retained 413/415 validation. The extra Express header and cookie methods are shared functions using their receiver's state, rather than fresh closures; all members remain installed on each context, and no shared Hono prototype is changed. The response-helper bindings and deferred continuation coordination remain intact.

A fresh before/after comparison of this audit worktree uses the same 100-connection, 3-second-warmup, three-by-5-second settings, with the normalised Express settings unchanged. This baseline includes the installed Inertia bridge and is distinct from both main and the primary checkout's pending Inertia optimisations.

| Node scenario | Req/s before → after | Change | CPU ms/request before → after | p99 ms before → after |
| --- | --: | --: | --: | --: |
| JSON | 6,841 → 8,617 | +26.0% | 0.1782 → 0.1360 | 27.506 → 18.568 |
| POST | 7,147 → 6,969 | −2.5% | 0.1638 → 0.1668 | 25.189 → 25.134 |
| Streaming | 4,069 → 4,460 | +9.6% | 0.2922 → 0.2589 | 35.095 → 36.993 |

JSON CPU cost falls by 23.6%. POST shows no improvement and streaming p99 is slightly worse; neither is hidden behind the JSON gain. Express JSON also varies from 10,670 to 10,162 req/s between batches, reinforcing the shared-host caveat. The fix does not restore an overall Node advantage over Express.

The completed follow-up also measures all four targets, with medians in requests per second:

| Scenario  | Hono/Bun | Hono/Node | Express/Node | Fastify/Node |
| --------- | -------: | --------: | -----------: | -----------: |
| JSON      |   13,041 |     8,617 |       10,162 |       12,891 |
| POST      |   10,587 |     6,969 |        8,520 |       10,263 |
| Streaming |    8,142 |     4,460 |        8,331 |        7,682 |

All 18 baseline and 36 completed follow-up samples record zero HTTP errors, and source hashes remain unchanged during the completed measurement. An earlier follow-up is interrupted by the executor's time limit and is excluded. Raw samples, comparison JSON and source fingerprints remain under `packages/benchmarks/results/node-fix-before-OT4PjtTF/` and `node-fix-after-wuiYF7YQ/`; generated benchmark documentation is not overwritten. The full Nest 12 check passes 808 tests and every bundle gate without raising a ceiling.

An independent temporary checkout with exactly the same changed source and regression tests also passes typecheck, build and all supported tests on Nest 11.2.10: 804 pass, four expected Nest-12-only skips and zero failures. Its benchmark Nest packages are explicitly aligned to 11 as well; unlike the earlier nested snapshot, it does not inherit optional peers from the primary checkout. This establishes local compatibility, not that the unmodified CI dependency-alignment recipe has been repaired. The primary checkout's staged Inertia work and both working checkouts' production dependency files remain untouched.

## Opportunities not implemented

- **Cross-request body/query caching:** rejected. Results are mutable and belong to a request; sharing them risks data crossing requests. Body parsing is already memoised on the context, and the request bag lazily caches query, headers and URL parts.
- **Removing eager parameter validation:** rejected. Wildcard decoding must still report malformed escapes as 400, including routes whose handler never reads parameters. Parameter caches must also follow Hono's route index across middleware hops.
- **Skipping body/encoding/size checks for ordinary POSTs:** rejected. A known content type is not a trusted body. Raw-body copies and streaming bounds are not removed to improve a score.
- **Caching CORS middleware by options identity:** rejected. It would freeze mutable settings and can accidentally reuse a per-request delegate result or origin decision. The retained candidate only avoids asynchronous work for values already synchronous.
- **Removing response-helper binding:** rejected. An extracted `const { json } = response` must remain callable, and middleware completion relies on assigning its answer.
- **Bootstrap closure cleanup:** not a measured request bottleneck. `bridgeOptions` is built when routes/middleware are registered, and lifecycle option getters are installed once per application; their appearance does not justify a hot-path rewrite.
- **Changing stream conversion/buffering:** deferred. `StreamableFile`, object-mode encoding, SSE backpressure, disconnects and upload streaming carry different contracts. A tiny finite stream is not evidence for optimising large or slow-client streams.
- **A route-wide compatibility bypass:** rejected. The adapter receives Nest's wrapped handler, not a trustworthy declaration that no guard, pipe, interceptor, filter or `@Res()` consumer will access the compatibility surface.
- **Query decoding and URL slicing:** deferred rather than duplicated. The primary checkout already contains experiments in `bag-state.ts`, `request.ts` and `query/names.ts`. Their correctness needs encoded delimiters, fragments, malformed escapes, repeated keys, forbidden names and pair limits.
- **Broad security, database, deployment and cold-start claims:** out of scope. Third-party database/broker tests use their documented in-memory or non-dialling fixtures; no external service or cloud deployment is load-tested.

## Reproduction

From the audit worktree:

```sh
bun install --frozen-lockfile
bun run check
PATH=/path/to/oha:$PATH NODE_ENV=production bun run bench --targets=bun,node,express,fastify --scenarios=plaintext,json,query,params,post,pipeline,pipes,middleware,stream,error,cors,inertia,inertia-html --duration=2 --warmup=1 --runs=3 --connections=50
PATH=/path/to/oha:$PATH NODE_ENV=production bun packages/benchmarks/dist/harness/run.js --targets=bun,node --scenarios=middleware,inertia,inertia-html,json,cors --duration=3 --warmup=2 --runs=5 --connections=50
node --expose-gc packages/core/test/response/settlement.bench.ts
bun --expose-gc packages/core/test/response/settlement.bench.ts
node --expose-gc packages/core/test/cors/cors.bench.ts
bun --expose-gc packages/core/test/cors/cors.bench.ts
```

The TypeScript microbenchmark is directly supported by the measured Node 26. It is not the network server; older Node versions can use Bun for that microbenchmark. Finite CPU/allocation/heap commands are documented in [the benchmark README](../packages/benchmarks/README.md#finite-profiling).

`docs/benchmarks.md` is generated by the broad final run. Raw network JSON, profiles, snapshots, GC logs and intermediate candidate measurements remain under the git-ignored `packages/benchmarks/results/audit/`. Large profiler artifacts are not added to the package or release.

### Final broad comparison

The normalised four-target run completes at `2026-11-16T22:40:52Z`. The native reference is repeated afterwards with the same connection, duration, warmup and repetition settings. Median requests per second:

| Scenario | Native Hono/Bun | Nest Hono/Bun | Nest Hono/Node | Nest Express/Node | Nest Fastify/Node |
| --- | --: | --: | --: | --: | --: |
| Text | 21,196 | 14,474 | 7,643 | 11,597 | 13,795 |
| JSON | 19,813 | 14,086 | 7,073 | 11,281 | 13,633 |
| Query | 20,122 | 11,909 | 7,062 | 10,620 | 12,769 |
| Parameters | 20,338 | 12,759 | 7,359 | 10,641 | 12,814 |
| POST | 17,711 | 10,992 | 7,435 | 8,852 | 10,765 |

Native Hono measurements, with latency/CPU cost in milliseconds and mean RSS in MiB:

| Scenario   |  p50 |  p95 |  p99 | CPU/request |  RSS |
| ---------- | ---: | ---: | ---: | ----------: | ---: |
| Text       | 2.24 | 3.42 | 4.54 |       0.048 | 46.1 |
| JSON       | 2.39 | 3.53 | 4.83 |       0.051 | 46.0 |
| Query      | 2.37 | 3.68 | 4.83 |       0.051 | 46.5 |
| Parameters | 2.33 | 3.62 | 4.73 |       0.050 | 47.1 |
| POST       | 2.70 | 4.14 | 5.44 |       0.058 | 47.5 |

The generated [full report](benchmarks.md) contains all 13 Nest scenarios, p99, CPU utilisation/cost and mean/peak RSS. Raw samples also contain p50/p95 and the remaining percentiles. Every recorded non-error scenario has zero HTTP status errors. Error-scenario samples count every completed response as an HTTP error, as expected for the 418 fixture; the fixture's status is also regression-tested.

The existing load normaliser retains HTTP error totals, not status-by-status histograms or generator transport-error details. Those totals do not certify the absence of TCP errors. Preserving the generator's full failure breakdown is a follow-up measurement improvement, not a production optimisation.

The broad Hono screen changes from 13,436 to 14,086 JSON req/s on Bun (+4.8%) and 5,833 to 7,073 on Node (+21.3%). These much larger Node movements do not agree with the focused comparison and must not be attributed to the tiny CORS change. The runs are separated in time on a shared WSL host; the broad result is a comparative screen, not the acceptance proof. The finite repeated CORS measurement and the explicitly reported mixed HTTP results are the evidence used for the decision.

Artifacts distinguish the phases: `before/network.json` is the original broad screen, `before/matched-network.json` the focused baseline, `settlement/` the rejected descriptor-only experiment, `after/` the combined experiment, `cors/` the retained CORS-only experiment, `final/network.json` the final normalised comparison, and `native-final.json` the repeated native reference. The hidden Nest 11 installation and profiling files occupy approximately 1.1 GiB locally; none of that installation is committed.

### Validation record

| Check | Result |
| --- | --- |
| Frozen install on Nest 12.1.3 | Pass; tracked lockfile unchanged |
| `bun run format` and `bun run format:check` | Pass |
| `bun run lint` | Pass |
| `bun run typecheck` | Pass |
| `bun run test` | 795 pass, 0 fail |
| Integration/compatibility, GraphQL, WS, Socket.IO, multipart, Inertia and SSE suites | Included in the passing full run |
| `bun run build` and `bun run size` | Pass; ceilings unchanged |
| Nest 11.2.10 typecheck/build after benchmark-major alignment | Pass |
| Nest 11 compatible tests | 791 pass, 0 fail; four Nest-12-only cases excluded |
| Unmodified Nest 11 CI recipe | Fails dependency alignment; not declared complete |
| Follow-up Nest 12 `bun run check` | 808 pass, 0 fail; lint, format, types, build and size pass |
| Follow-up Nest 11.2.10 checkout | 804 pass, 4 skips, 0 fail; typecheck, build and size pass |
| Follow-up benchmark samples | 54 samples, zero HTTP errors; source hashes unchanged |

The Nest 11 snapshot takes the committed production source and unpacks the final benchmark source and tests into the ignored hidden `results/audit/.nest11` directory. Dependency changes and its lockfile remain only inside that validation copy. Logs preserve the initial failure, the extra benchmark alignment and the passing compatible runs.

```sh
# In a fresh, independently installed copy configured for Nest 11:
HUSKY=0 bun add --cwd packages/benchmarks @nestjs/common@^11.x @nestjs/core@^11.x @nestjs/platform-express@^11.x @nestjs/platform-fastify@^11.x
bun run typecheck
bun run build
# Only needed for a nested validation copy whose parent still installs Nest 12 peers:
bun test --path-ignore-patterns '**/optional.test.ts'
```

### Review

The branch carries the implementation in `packages/core`, the benchmark fixtures and profilers, the settlement regression coverage and the comparison-setting alignment. Nothing is pushed and no pull request is opened.

### Changed files and remaining checks

- `packages/core/src/features/cors/middleware/bridge.ts` is the only changed file of the CORS change.
- The follow-up changes `packages/core/src/core/request/body/guards.ts` and `packages/core/src/compat/express/surface-extras.ts`, with `packages/core/test/bodies/body-presence.test.ts` and `packages/core/test/express-surface/surface-extras.test.ts` as their regression coverage.
- `packages/core/test/cors/` and `packages/core/test/response/` hold regression cases and the two finite microbenchmarks.
- `packages/benchmarks/src/app/`, `src/harness/`, `test/base.test.ts` and its typecheck configuration hold workloads, profilers and comparison controls.
- This report, the generated benchmark report and the benchmark README record methodology, measurements and commands.

No long-duration leak test, concurrency sweep, TLS/HTTP2/HTTP3 comparison, real cloud deployment, slow-client streaming benchmark, large multipart load, GraphQL load or WebSocket load is performed. Those protocols have functional regression coverage, not throughput certification. Native Hono is not a Nest parity test. A small Node HTTP regression cannot be ruled out by this shared-host sample. The unmodified Nest 11 CI recipe still needs alignment and a genuine CI rerun before the repository's full completion gate can be claimed.
