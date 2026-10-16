# @ailura/nestjs-hono-adapter-compatibility

A private workspace package whose only job is to prove that the adapter serves a Nest application built with the third-party Nest packages the adapter has to run alongside. It ships no code, is never published, carries no release entry and sits outside the size gate.

## What is proved

The boot-and-route cases under [`test/cases`](./test/cases) each boot a Nest application on the adapter's Bun transport, make a request through it, and assert the route answered. That is the whole claim: the package's module graph initialises inside an application the adapter serves, and a request still round-trips. It is not a re-test of the third-party package — each package's own behaviour is its own suite's concern, and the adapter's behaviour is the one [the core suite](../../packages/core/test) already covers.

The behaviour suites moved over from the core suite — `cache-manager`, `config`, `cqrs`, `event-emitter`, `jwt`, `microservices`, `schedule`, `swagger`, `terminus`, `testing`, `throttler` — go deeper than a boot: each asserts what its package does through the adapter. They live here so every third-party Nest package the adapter runs alongside is proved in one workspace.

A few cases assert one step further, where the step crosses the adapter: `@nestjs/mapped-types` validates a DTO through the adapter's body decode, and `@nestjs/authentication` refuses an unauthenticated request through the adapter's request object.

## Running it

```sh
bun run test        # the core has to be built first: `bun run build:core`
```

At the repository root `bun test` picks the suite up, so `bun run check` and the `compat` matrix in CI run it too. The matrix runs it on Nest 11 and 12; on 11 it removes the three packages that only peer `^12` and their cases skip.

## The matrix

Every package below is proved against a Nest application served by the adapter. Most are proved here, in the suite named beside them: the deeper behaviour suites moved over from `packages/core/test`, and the boot-and-route cases under [`test/cases`](./test/cases). The four bridges are proved in their own package, and `@nestjs/common` and `@nestjs/core` by the adapter's own suite.

| Nest package | Where it is proved |
| --- | --- |
| `@nestjs/apollo` | [`packages/graphql`](../graphql/test) (bridge over Apollo) |
| `@nestjs/authentication` | [`test/optional.test.ts`](./test/optional.test.ts) — peers `^12` only |
| `@nestjs/authorization` | [`test/optional.test.ts`](./test/optional.test.ts) — peers `^12` only |
| `@nestjs/axios` | [`test/cases`](./test/cases) |
| `@nestjs/bull` | [`test/cases`](./test/cases) |
| `@nestjs/cache-manager` | [`test/cache-manager`](./test/cache-manager) |
| `@nestjs/common` | the adapter's own suite |
| `@nestjs/config` | [`test/config`](./test/config) |
| `@nestjs/core` | the adapter's own suite |
| `@nestjs/cqrs` | [`test/cqrs`](./test/cqrs) |
| `@nestjs/devtools-integration` | [`test/optional.test.ts`](./test/optional.test.ts) — peers `^12` only |
| `@nestjs/event-emitter` | [`test/event-emitter`](./test/event-emitter) |
| `@nestjs/graphql` | [`packages/graphql`](../graphql/test) (bridge) |
| `@nestjs/http-client` | [`test/cases`](./test/cases) |
| `@nestjs/jwt` | [`test/jwt`](./test/jwt) |
| `@nestjs/mapped-types` | [`test/mapped-types.test.ts`](./test/mapped-types.test.ts) |
| `@nestjs/microservices` | [`test/microservices`](./test/microservices) |
| `@nestjs/mongoose` | [`test/cases`](./test/cases) |
| `@nestjs/observe` | [`test/cases`](./test/cases) |
| `@nestjs/outbox` | [`test/cases`](./test/cases) |
| `@nestjs/passport` | [`test/jwt`](./test/jwt) |
| `@nestjs/platform-socket.io` | [`packages/socket-io`](../socket-io/test) (bridge) |
| `@nestjs/platform-ws` | [`packages/ws`](../ws/test) (bridge) |
| `@nestjs/schedule` | [`test/schedule`](./test/schedule) |
| `@nestjs/sequelize` | [`test/cases`](./test/cases) |
| `@nestjs/serve-static` | [`packages/serve-static`](../serve-static/test) (bridge) |
| `@nestjs/swagger` | [`test/swagger`](./test/swagger) |
| `@nestjs/terminus` | [`test/terminus`](./test/terminus) |
| `@nestjs/testing` | [`test/testing`](./test/testing) |
| `@nestjs/throttler` | [`test/throttler`](./test/throttler) |
| `@nestjs/typeorm` | [`test/cases`](./test/cases) |
| `@nestjs/websockets` | [`packages/core/test/socket`](../core/test/socket), [`packages/ws`](../ws/test) |

## Why nothing reaches for a server

The adapter is the HTTP layer, so no suite reaches for a broker or a database server. Where a package can run without one, it does:

- `@nestjs/typeorm` runs a real in-memory database on the `sqljs` driver and counts a row, so its case is a full round trip.
- `@nestjs/mongoose` opens a lazy connection that never dials, and asserts the injected model's name.
- `@nestjs/sequelize` resolves its models without dialling. Sequelize's SQLite dialect loads the `sqlite3` native addon on construction, and that addon has no build for Bun, so the case supplies a `dialectModule` to keep the addon out and stops short of a query. The connection is the package's own and never the adapter's; a deployment on Bun needs a Bun-compatible driver.
- `@nestjs/bull` sets `lazyConnect`, so the queue dials Redis only when a job is added; the case never adds one.
- `@nestjs/observe`, `@nestjs/outbox`, `@nestjs/authentication` and `@nestjs/authorization` boot on their in-memory defaults.
- `@nestjs/microservices` binds a TCP microservice on a free localhost port, and `@nestjs/config` reads a checked-in `.env` file.

## Adding a package

Add a case to `test/cases/`, or, when the package peers on one Nest major only, add it to `test/optional.test.ts` so the other line skips it instead of failing to load. When the package needs more than a boot-and-route smoke test, add a suite under `test/<package>/` built on the shared `#test/probe` harness, the way the core suites do. Declare the package in `devDependencies` with a range the matrix can move, or an exact version when only one major exists.
