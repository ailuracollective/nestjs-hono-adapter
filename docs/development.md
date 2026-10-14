# Development

## Requirements

- Bun 1.2 or later, for the toolchain and the default transport.
- Node 22.12 or later to run on Node, where the Node transport
  serves through `@hono/node-server`.
- Nest 11 or 12.
- Hono 4.

## Development

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` is exactly what CI runs — lint, format,
typecheck, test, build and the bundle size gate — through
oxlint, oxfmt, `tsc`, `bun test` and size-limit.

Every part of the adapter is a workspace package: `core` is the
adapter, published as `@ailura/nestjs-hono-adapter`; `ws`,
`socket-io` and `multipart` are the capability packages. The
root is only the private Bun workspace root — no `src/`, no
published package. The build order is the adapter first, then
the capabilities: `build:core` compiles into
`packages/core/dist`, which `.`, `./bun-server`, `./node-server`
and `./fetch` serve, and each capability compiles into its own
`dist/` (`packages/ws/dist`, `packages/socket-io/dist`,
`packages/multipart/dist`) — it builds first because the
capabilities resolve it through
`node_modules/@ailura/nestjs-hono-adapter` →
`packages/core/dist` and a clean checkout has no core `dist`, so
`test` and `typecheck` build it first too and `ws` and
`multipart` read its declarations from there. Each package
carries its own `"size": "size-limit"` script and a
`.size-limit.json` beside its `package.json`; the root's `size`
builds once and fans out to all four. Behaviour tests live under
`packages/<name>/test/` with each package's own `test` script;
the root's `test/` holds only the guards and shared helpers
(`test/probe.ts`, `test/bun-adapter.ts`,
`test/bun-bindings.ts`), reached as `#test/probe.ts`,
`#test/bun-adapter.ts` and so on.

### The lockfile format the build image reads

`bun.lock` is written in the format the oldest toolchain in the
path understands. The Cloudflare build image that builds
`examples/cloudflare` ships Bun 1.2.15, which refuses a
`lockfileVersion: 2` lockfile — `bun install --frozen-lockfile`
stops at `Unknown lockfile version` — and Bun 1.4.2 writes
version 2 on a plain `bun install`, so a locally rewritten
lockfile breaks that build without a line of source changing.

- Regenerate with the image's Bun: 1.2.x writes version 1, which
  every later Bun reads, so only the header and format change.
- Or set `BUN_VERSION` in the Cloudflare project to the version
  this repository develops against and keep the version 2 file.

`bun install --frozen-lockfile` never rewrites the header, so CI
and a disposable checkout are safe either way; a plain
`bun install` changes it. CI fails if the header stops being
version 1: the `lockfile` job in `.github/workflows/ci.yml`
parses `lockfileVersion` from the JSON-with-comments file and
refuses any other value. Before changing a file, read
[docs/architecture.md](architecture.md): it maps the layer
regions, the five dependency rules between the packages, the
frozen builtin surface and the bundle ceilings.

The adapter builds against two Nest majors: the suite runs
against the lockfile's version, and CI's compatibility job
installs Nest 11 and 12 — every `@nestjs/*` package moves
together, because a mixed install is what a gateway or
microservice case would fail on, not the adapter. `bun add`
rewrites `package.json` and `bun.lock`, so run the check in a
disposable checkout or restore both first. The tests are
transpiled from the root `tsconfig.json`, which turns
`experimentalDecorators` and `emitDecoratorMetadata` on for the
fixtures (Nest controllers with legacy decorators); the library
declares no decorator, so neither flag changes `bun run build`.

```sh
bun add --exact @nestjs/common@11.x @nestjs/core@11.x @nestjs/websockets@11.x @nestjs/microservices@11.x @nestjs/testing@11.x
bun run check && git restore package.json bun.lock && bun install --frozen-lockfile
```

## Release

Releases run through
[release-please](https://github.com/googleapis/release-please).
Four packages release from `packages/`: the adapter at
`packages/core` (`@ailura/nestjs-hono-adapter`) and the
capabilities `@ailura/nestjs-platform-hono-ws`,
`@ailura/nestjs-platform-hono-socket-io` and
`@ailura/nestjs-platform-hono-multipart`.
`release-please-config.json` declares one component per package
— `packages/core`, plus `socket-io`, `ws` and `multipart` — and
`.release-please-manifest.json` records each last released
version. On every push to `main`, release-please opens a release
pull request per package with its version bump and generated
changelog; merging one creates that package's tag and GitHub
release. The adapter is tagged `vX.Y.Z`; the capabilities set
`include-component-in-tag`, so their tags are
`socket-io-vX.Y.Z`, `ws-vX.Y.Z` and `multipart-vX.Y.Z`. Nothing
is published directly, so a release is a reviewed change, and a
release pull request is exempt from the policy gates by its head
ref. Merging one publishes that package to npm: the GitHub
release fires `.github/workflows/publish.yml`, which resolves
the package directory from the tag (`v*` → `packages/core`,
`socket-io-v*` → `packages/socket-io`, `ws-v*` → `packages/ws`,
`multipart-v*` → `packages/multipart`), checks out the tag,
builds with `bun run build`, and runs
`npm publish <directory> --provenance` under OIDC trusted
publishing, so no npm token is stored anywhere. One order
matters and no configuration enforces it: the adapter must be
published before the capabilities that peer on it (`multipart`
requires it, `ws` takes it as an optional peer), so publish the
adapter's release first.

## License

MIT
