# Benchmark suite

A private, never-published comparison of the NestJS HTTP adapters:

| Target    | Adapter                                        | Runtime |
| --------- | ---------------------------------------------- | ------- |
| `bun`     | `@ailura/nestjs-hono-adapter` + `bunServer()`  | Bun     |
| `node`    | `@ailura/nestjs-hono-adapter` + `nodeServer()` | Node    |
| `express` | `@nestjs/platform-express`                     | Node    |
| `fastify` | `@nestjs/platform-fastify`                     | Node    |

All four serve the **same pair** of Nest applications. `platform-express` is Nest's default, and `platform-fastify` is the fast baseline. Measured on both Bun and Node.

The base scenarios run on an application that does not import Inertia, so its global interceptors and middleware cannot tax routes that never render a page. The Inertia scenarios run on an application that mounts the module and the React, Vue and Svelte SSR scopes. Both applications carry the same base controller.

Express ETag generation and `X-Powered-By` are disabled. The official adapters' CORS method list and max age match Hono's defaults. Hono keeps its default options rather than parsing an explicit list on every request. Wire details such as header whitespace, `Vary` and transport keep-alive defaults may still differ.

The suite follows the workspace's Nest major instead of pinning one: its `@nestjs/*` dependencies are ranges (`>=11 <13`), so the compatibility job's `bun add` moves it along with the rest of the workspace, and `bun.lock` fixes the version actually measured.

## Scenarios

Base scenarios use the application without Inertia; Inertia scenarios use the application that mounts it.

| Scenario | App | Route | What it exercises |
| --- | --- | --- | --- |
| `plaintext` | base | `GET /health` | routing and keep-alive |
| `json` | base | `GET /hello` | JSON serialization |
| `query` | base | `GET /query?…` | query parsing |
| `params` | base | `GET /users/:id` | route parameters |
| `post` | base | `POST /echo` | body parsing |
| `pipeline` | base | `GET /pipeline` | guard + interceptor + DI |
| `pipes` | base | `GET /pipes/:id` | stock `ParseIntPipe` |
| `middleware` | base | `GET /middleware` | scoped Nest middleware |
| `stream` | base | `GET /stream` | fully consumed `StreamableFile` |
| `inertia` | Inertia | `GET /inertia` | Inertia JSON page render |
| `inertia-html` | Inertia | `GET /inertia` | Inertia first-load shell |
| `inertia-react` | Inertia | `GET /inertia-react?created=1` | React SSR contact list with success flash |
| `inertia-react-form` | Inertia | `GET /inertia-react/form?error=email` | React SSR form with a validation error |
| `inertia-react-submit` | Inertia | `POST /inertia-react/form` | React form submit and redirect |
| `inertia-vue` | Inertia | `GET /inertia-vue?created=1` | Vue SSR contact list with success flash |
| `inertia-vue-form` | Inertia | `GET /inertia-vue/form?error=email` | Vue SSR form with a validation error |
| `inertia-vue-submit` | Inertia | `POST /inertia-vue/form` | Vue form submit and redirect |
| `inertia-svelte` | Inertia | `GET /inertia-svelte?created=1` | Svelte SSR contact list with success flash |
| `inertia-svelte-form` | Inertia | `GET /inertia-svelte/form?error=email` | Svelte SSR form with a validation error |
| `inertia-svelte-submit` | Inertia | `POST /inertia-svelte/form` | Svelte form submit and redirect |
| `error` | base | `GET /boom` | exception path (418) |
| `cors` | base | `OPTIONS /hello` | CORS preflight |

The three SSR apps are the same small contacts application in React, Vue and Svelte: a list page with a success flash, a form page with a field error, and a submit route that validates and redirects back to one of them. Pages are real framework components without styles, and each form uses the adapter's `useForm` composer.

## Metrics and tools

- **Throughput**: requests per second (median).
- **Latency**: p99 in milliseconds; the JSON samples carry the whole percentile breakdown — min, p50, p90, p95, p99, mean and max.
- **Errors**: count outside 2xx/3xx (`error` route responds with 418).
- **Resources**: the server process CPU (percent of one core, and milliseconds per request) and RSS (mean and peak), sampled with [pidusage](https://github.com/soyuka/pidusage) during the measured window only.
- **Generators**: [oha](https://github.com/hatoo/oha) (default) and [bombardier](https://github.com/codesenberg/bombardier).
- **Compilation**: `tsc` compiles the Nest application, the harness and the React pages once to plain JS; the Vue and Svelte SSR entries are bundled with their own compilers so code is identical across runtimes.

```sh
# oha: cargo install oha (or github.com/hatoo/oha/releases)
# bombardier: go install github.com/codesenberg/bombardier@latest
```

## Run

```sh
bun install --frozen-lockfile
bun run bench

# Custom run from packages/benchmarks:
bun run build
bun dist/harness/run.js --help
bun dist/harness/run.js --targets=bun --scenarios=json --duration=5
bun dist/harness/run.js --tool=both
bun dist/harness/run.js --connections=50 --runs=5
```

Reports land in `packages/benchmarks/results/` as JSON samples; the metrics page is written to `docs/benchmarks.md` at the repository root, ready to commit. The page is generated, so `.oxfmtrc.json` excludes it from the formatter, the way it excludes `CHANGELOG.md`.

## Profile

Bun's CPU profiler attributes the server's CPU time, which is what a scenario is bound by at 100 connections. Profile one target directly instead of the whole suite:

```sh
cd packages/benchmarks
bun --cpu-prof --cpu-prof-md --cpu-prof-dir=/tmp/prof \
  dist/harness/server/server-entry.js bun 3100 base &
bunx oha -z 15s -c 100 http://127.0.0.1:3100/health
kill %1   # the profile is written when the process exits
```

`--cpu-prof-md` writes a markdown profile beside the `.cpuprofile`, which is enough for a first pass; open the `.cpuprofile` in Chrome DevTools or Speedscope for the call tree. The base app serves `plaintext`, `json`, `post` and `error`; the Inertia app, which takes `inertia` as its third argument, serves the rest.

Two things skew a profile: the profiler itself costs about 10–20% of throughput, so read shares rather than absolute requests per second, and about half of the CPU at 100 connections on loopback is kernel time, so a change that removes JavaScript work shows up smaller than the profile suggests. Verify every change with an A/B run, not with the profile alone.

The compiled tree resolves `#adapter/*` through the nearest `tsconfig.json`, which is `packages/core/tsconfig.json` and maps to `packages/core/src/`. A profile therefore shows the adapter sources, not `packages/core/dist/`, and a stale build mixes the two. Run `bun run build:core` before profiling or benchmarking.

## Methodology

1. **Warm up, then discard**: `--warmup` seconds before measurement.
2. **Repeat and take median**: `--runs` times to resist outliers.
3. **Shape over average**: p99 beside throughput, and the percentile breakdown in the JSON samples.
4. **Target 127.0.0.1**: avoids IPv6 overhead.
5. **Inherit environment**: sees harness's `NODE_ENV`.
6. **Watch the server**: CPU and RSS are polled from the target process, and only inside the measured window, so warmup and cooldown never count.

Results are comparative on this machine, not absolute production numbers.

### Finite profiling

The finite fetch workload uses the same base module without a network client. It asserts a successful response and drains each body, warms up for 10,000 requests, and reports CPU and memory around the measured loop. Profiles include framework startup and warmup; they are not network throughput measurements. Bridge discovery still installs optional bridges present in the workspace, even when the base module has no Inertia providers.

From the repository root, after `bun run bench` has built the suite:

```sh
mkdir -p packages/benchmarks/results/profiles
node --expose-gc --cpu-prof --cpu-prof-dir=packages/benchmarks/results/profiles packages/benchmarks/dist/harness/profile.js /middleware 100000
bun --expose-gc --cpu-prof --cpu-prof-dir=packages/benchmarks/results/profiles packages/benchmarks/dist/harness/profile.js /middleware 100000
node --expose-gc packages/benchmarks/dist/harness/allocations.js /middleware 100000 > packages/benchmarks/results/profiles/allocations.jsonl
node --expose-gc --trace-gc packages/benchmarks/dist/harness/profile.js /middleware 100000
node --expose-gc packages/core/test/cors/cors.bench.ts
bun --expose-gc packages/core/test/cors/cors.bench.ts
```

The last JSON line of `allocations.jsonl` is a V8 allocation-sampling profile, including objects collected by both minor and major GC. Its byte counts are statistical estimates, not exact allocation counts. An optional third argument to `profile.js` writes a heap snapshot; snapshot runs are separate from CPU measurements because taking a snapshot dominates the profile. On Bun this uses `Bun.generateHeapSnapshot()`, and on Node it uses `node:v8.writeHeapSnapshot()`. Heap snapshots show survivors, not total allocation churn.

The CORS microbenchmark warms 10,000 requests and measures 200,000 static preflights with reused immutable request input. It isolates scheduling and response work, not network throughput. It runs directly on Bun and the measured Node 26; older Node versions may need TypeScript-stripping support.

`bun packages/benchmarks/dist/harness/server/native-entry.js 3000` serves native Hono on Bun for text, JSON, simple query, params and JSON POST references, with CORS enabled. It has no Nest middleware, guards, pipes or body-limit contract and is therefore a lower-bound reference, not an equivalent Nest target. The native process is stopped with SIGTERM after measurement.

## Layout

- `src/app/`: shared Nest application
- `src/harness/`: orchestrator, load wrappers, report
- `tsconfig.json`: typechecks against the adapter's sources
- `tsconfig.build.json`: emits against the adapter's built declarations
- `tsconfig.dist.json`: copied to `dist/tsconfig.json` so the compiled tree resolves `#benchmarks/*` through `package.json#imports` to `dist/`, not back to `src/`
- `../../docs/benchmarks.md`: generated metrics page (committed)
- `results/`: raw JSON samples (git-ignored)
- `dist/`: compiled output (git-ignored)

## CI

`.github/workflows/benchmarks.yml` runs a short inline comparison on demand and weekly: it serves every target once, uploads the raw samples, and sets no performance threshold, since a shared runner is too noisy for one.
