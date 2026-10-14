# Benchmark suite

A private, never-published comparison of the NestJS HTTP
adapters:

| Target    | Adapter                                        | Runtime |
| --------- | ---------------------------------------------- | ------- |
| `bun`     | `@ailura/nestjs-hono-adapter` + `bunServer()`  | Bun     |
| `node`    | `@ailura/nestjs-hono-adapter` + `nodeServer()` | Node    |
| `express` | `@nestjs/platform-express`                     | Node    |
| `fastify` | `@nestjs/platform-fastify`                     | Node    |

All four serve the **same** Nest application. `platform-express`
is Nest's default, and `platform-fastify` is the fast baseline.
Measured on both Bun and Node.

The suite follows the workspace's Nest major instead of pinning
one: its `@nestjs/*` dependencies are ranges (`>=11 <13`), so
the compatibility job's `bun add` moves it along with the rest
of the workspace, and `bun.lock` fixes the version actually
measured.

## Scenarios

| Scenario    | Route            | What it exercises        |
| ----------- | ---------------- | ------------------------ |
| `plaintext` | `GET /health`    | routing and keep-alive   |
| `json`      | `GET /hello`     | JSON serialization       |
| `query`     | `GET /query?…`   | query parsing            |
| `params`    | `GET /users/:id` | route parameters         |
| `post`      | `POST /echo`     | body parsing             |
| `pipeline`  | `GET /pipeline`  | guard + interceptor + DI |
| `error`     | `GET /boom`      | exception path (418)     |
| `cors`      | `OPTIONS /hello` | CORS preflight           |

## Metrics & Tools

- **Throughput**: requests per second (median).
- **Latency**: p99 in milliseconds, plus full histogram in JSON.
- **Errors**: count outside 2xx/3xx (`error` route responds with
  418).
- **Resources**: the server process CPU (percent of one core,
  and milliseconds per request) and RSS (mean and peak), sampled
  with [pidusage](https://github.com/soyuka/pidusage) during the
  measured window only.
- **Generators**: [oha](https://github.com/hatoo/oha) (default)
  and [bombardier](https://github.com/codesenberg/bombardier).
- **`tsc`**: compiles once to plain JS so code is identical
  across runtimes.

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
```

Reports land in `packages/benchmarks/results/` as JSON samples;
the metrics page is written to `docs/benchmarks.md` at the
repository root, ready to commit. The page is generated, so
`.oxfmtrc.json` excludes it from the formatter, the way it
excludes `CHANGELOG.md`.

## Methodology

1. **Warm up, then discard**: `--warmup` seconds before
   measurement.
2. **Repeat and take median**: `--runs` times to resist
   outliers.
3. **Shape over average**: p99 beside throughput and full
   histogram in JSON.
4. **Target 127.0.0.1**: avoids IPv6 overhead.
5. **Inherit environment**: sees harness's `NODE_ENV`.
6. **Watch the server**: CPU and RSS are polled from the target
   process, and only inside the measured window, so warmup and
   cooldown never count.

Results are comparative on this machine, not absolute production
numbers.

## Layout

- `src/app/`: shared Nest application
- `src/harness/`: orchestrator, load wrappers, report
- `tsconfig.json`: typechecks against the adapter's sources
- `tsconfig.build.json`: emits against the adapter's built
  declarations
- `tsconfig.dist.json`: copied to `dist/tsconfig.json` so the
  compiled tree resolves `#benchmarks/*` through
  `package.json#imports` to `dist/`, not back to `src/`
- `../../docs/benchmarks.md`: generated metrics page (committed)
- `results/`: raw JSON samples (git-ignored)
- `dist/`: compiled output (git-ignored)
