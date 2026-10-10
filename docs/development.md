# Development

How to build, test and release this package.

## Contents

- [Requirements](#requirements)
- [Development](#development)
- [Release](#release)
- [License](#license)

## Requirements

- Bun 1.2 or later, for the toolchain.
- Node 22.12 or later to run on Node, where `@hono/node-server`
  is the default transport; the same transport runs on Bun.
- Nest 11 or 12.
- Hono 4.

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
builtin surface is, and why the bundle ceilings behave the way
they do.

The cases start a real application on an ephemeral port and talk
to it over `fetch`, so they cover the path and query dialects,
every body type, the response forms, event streams, CORS, views,
static assets, TLS selection, proxy headers and shutdown. They
run on Bun, against the server the adapter drives.

The adapter builds against two Nest majors. The suite runs
against the version the lockfile pins, and the CI compatibility
job installs Nest 11 and 12 — every `@nestjs/*` package moves
together, because a mixed install is what a gateway or a
microservice case would fail on rather than the adapter.
`bun add` rewrites `package.json` and `bun.lock`, so run the
check in a disposable checkout, or restore both files before the
frozen install:

```sh
bun add --exact @nestjs/common@11.x @nestjs/core@11.x \
  @nestjs/websockets@11.x @nestjs/microservices@11.x \
  @nestjs/testing@11.x
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

## Release

Releases run through
[release-please](https://github.com/googleapis/release-please).
On every push to `main` it opens a release pull request with the
version bump and the generated changelog; merging it creates the
tag and the GitHub release. Nothing is published directly, so a
release is a reviewed change like any other — and the release
pull request is exempt from the policy gates by its head ref.

Merging the release pull request publishes the package to npm:
the GitHub release fires `.github/workflows/publish.yml`, which
builds the tagged commit and runs `npm publish --provenance`
under OIDC trusted publishing, so no npm token is stored
anywhere.

## License

MIT
