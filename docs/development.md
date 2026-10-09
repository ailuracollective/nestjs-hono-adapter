# Development

How to build, test and release this package.

## Contents

- [Requirements](#requirements)
- [Development](#development)
- [License](#license)

## Requirements

- Node 22.12 or later (22.x and 24.x tested; 26.x ready as it
  enters LTS).
- Nest 11 or 12.
- Hono 4 and `@hono/node-server` 2.

## Development

Bun installs and runs the workspace; the gates are oxlint,
oxfmt, `tsc`, `bun test` and size-limit.

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` is exactly what CI runs: lint, format,
typecheck, test, build and the bundle size gate.

Before changing a file, read
[docs/architecture.md](architecture.md): it maps the regions of
`src/`, the four dependency rules between them, what the frozen
Node surface is, and why the bundle ceilings behave the way they
do.

The cases start a real application on an ephemeral port and talk
to it over `fetch`, so they cover the path and query dialects,
every body type, the response forms, event streams, CORS, views,
static assets, TLS selection, proxy headers and shutdown. The
TLS case runs its check in a child Node process, because the
suite has to see the server class the way a consumer would, from
a plain Node process rather than from the test runner.

The adapter builds against two Nest majors. The suite runs
against the version the lockfile pins, and the CI compatibility
job installs Nest 11 and 12 on Node 22 and 24 — every
`@nestjs/*` package moves together, because a mixed install is
what a gateway or a microservice case would fail on rather than
the adapter. `bun add` rewrites `package.json` and `bun.lock`,
so run the check in a disposable checkout, or restore both files
before the frozen install:

```sh
bun add --exact @nestjs/common@11.x @nestjs/core@11.x \
  @nestjs/websockets@11.x @nestjs/microservices@11.x
bun run check
git restore package.json bun.lock
bun install --frozen-lockfile
```

The tests are transpiled from the root `tsconfig.json` through
Bun's transpiler, and the fixtures are Nest controllers whose
decorators are the legacy kind, which is why that file turns
`experimentalDecorators` and `emitDecoratorMetadata` on. The
library declares no decorator, so neither flag changes what
`bun run build` emits.

## License

MIT
