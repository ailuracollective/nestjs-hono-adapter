# Development

How to build, test and release the packages.

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

Every part of the adapter is a workspace package now, and the
root's `src/` is four re-export shims over
`@ailura/nestjs-hono-adapter-core`. The build order is the core,
the shims, then the capabilities, and the root's scripts say it
exactly:

```sh
"build": "bun run build:core && tsc -p tsconfig.json && bun run build:packages",
"build:core": "bun run --filter @ailura/nestjs-hono-adapter-core build",
"build:packages": "bun run --filter @ailura/nestjs-hono-adapter-socket-io --filter @ailura/nestjs-hono-adapter-ws --filter @ailura/nestjs-hono-adapter-multipart build",
"test": "bun run build:core && bun test",
"typecheck": "bun run build:core && tsc -p tsconfig.json --noEmit && tsc -p test/tsconfig.json"
```

`build:core` compiles the core into `packages/core/dist`; the
root's `tsc` compiles the shims into `dist/`, which is what `.`,
`./bun-server`, `./node-server` and `./fetch` serve; and each
capability's `tsconfig.compat.json` emits its sources into the
root's `dist/` for its subpath (`dist/socket-io`, `dist/ws`,
`dist/multipart`). `test` and `typecheck` build the core first
too, because the root resolves it through
`node_modules/@ailura/nestjs-hono-adapter-core` →
`packages/core/dist`, and a clean checkout has no core `dist`
yet. The `ws` and `multipart` compat projects read the core's
declarations from `packages/core/dist`, which is why the core
builds first.

Each package carries its own behaviour tests under
`packages/<name>/test/` and has its own `test` script; the
root's `test/` holds only the guards and the shared helpers
(`test/probe.ts`, `test/bun-adapter.ts`,
`test/bun-bindings.ts`), which a package reaches through a
relative path like `../../../test/probe.ts`.

### The lockfile format the build image reads

`bun.lock` is written in the format the oldest toolchain in the
path understands. The Cloudflare build image that builds
`examples/cloudflare` ships Bun 1.2.15, which refuses a
`lockfileVersion: 2` lockfile: `bun install --frozen-lockfile`
stops at `Unknown lockfile version` before it builds anything.
Bun 1.4.2 writes version 2 on a plain `bun install`, so a
lockfile rewritten locally by a newer Bun breaks that build
without a line of source changing.

There are two ways out, and one of them belongs to the
Cloudflare project:

- Regenerate the file with the version the image pins. Bun 1.2.x
  writes version 1 and every later Bun reads it, so the graph
  stays what it was and only the header and the format change.
- Or set `BUN_VERSION` in the Cloudflare project to the version
  this repository develops against, and keep the version 2 file.

`bun install --frozen-lockfile` never rewrites the header, so CI
and a disposable checkout are safe either way; a plain
`bun install` is what changes it. CI fails if the header stops
being version 1: the `lockfile` job in
`.github/workflows/ci.yml` parses `lockfileVersion` from the
JSON-with-comments file and refuses any other value.

Before changing a file, read
[docs/architecture.md](architecture.md): it maps the regions of
`packages/core/src/` and the root's shims, the five dependency
rules between them, what the frozen builtin surface is, and why
the bundle ceilings behave the way they do.

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
The repository releases five packages: the adapter at the root,
the core at `packages/core`, and the three capability packages
under `packages/`. `release-please-config.json` declares one
component per package — `.` at the root, and `core`,
`socket-io`, `ws` and `multipart` — and
`.release-please-manifest.json` records the last released
version of each. On every push to `main`, release-please opens a
release pull request per package with that package's version
bump and generated changelog; merging one creates that package's
tag and GitHub release. The root is tagged `vX.Y.Z`; the package
components set `include-component-in-tag`, so their tags are
`core-vX.Y.Z`, `socket-io-vX.Y.Z`, `ws-vX.Y.Z` and
`multipart-vX.Y.Z`. Nothing is published directly, so a release
is a reviewed change like any other — and a release pull request
is exempt from the policy gates by its head ref.

Merging a release pull request publishes that package to npm:
the GitHub release fires `.github/workflows/publish.yml`, which
resolves the package directory from the tag (`core-v*` is
`packages/core`, `socket-io-v*` is `packages/socket-io`, `ws-v*`
is `packages/ws`, `multipart-v*` is `packages/multipart`, `v*`
is the root), checks out the tag, builds it with
`bun run build`, and runs `npm publish <directory> --provenance`
under OIDC trusted publishing, so no npm token is stored
anywhere.

One order matters and no configuration enforces it: the core
must be published before the root and before the capability
packages that peer on it (`multipart` requires it, `ws` takes it
as an optional peer). release-please cuts one independent
release per package, so publish the core's release first.

## License

MIT
