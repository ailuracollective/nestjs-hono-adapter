# Development

## Requirements

- Bun 1.2 or later, for the toolchain and the default transport.
- Node 22.12 or later to run on Node, where the Node transport serves through `@hono/node-server`.
- Nest 11 or 12.
- Hono 4.

## Development

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` is exactly what CI runs — lint, format, typecheck, test, build and the bundle size gate — through oxlint, oxfmt, `tsc`, `bun test` and size-limit.

Every part of the adapter is a workspace package: `core` is the adapter, published as `@ailura/nestjs-hono-adapter`; `multipart` is the capability package; and `graphql`, `serve-static`, `socket-io` and `ws` are the compatibility bridges. The root is only the private Bun workspace root — no `src/`, no published package. The build order is the adapter first, then the rest: `build:core` compiles into `packages/core/dist`, which `.`, `./bun-server`, `./node-server` and `./fetch` serve, and each other package compiles into its own `dist/` (`packages/ws/dist`, `packages/socket-io/dist`, `packages/multipart/dist`, `packages/graphql/dist`, `packages/serve-static/dist`) — it builds first because they resolve it through `node_modules/@ailura/nestjs-hono-adapter` → `packages/core/dist` and a clean checkout has no core `dist`, so `test` and `typecheck` build it first too. `test` also builds the bridge packages, which the region resolves by name, and `ws` and `multipart` read its declarations from there. Each package carries its own `"size": "size-limit"` script and a `.size-limit.json` beside its `package.json`; the root's `size` builds once and fans out to every package. Behaviour tests live under `packages/<name>/test/` with each package's own `test` script; the root's `test/` holds only the guards and shared helpers (`test/probe.ts`, `test/bun-adapter.ts`, `test/bun-bindings.ts`), reached as `#test/probe.ts`, `#test/bun-adapter.ts` and so on.

### The lockfile format the build image reads

`bun.lock` is written in the format the oldest toolchain in the path understands. The Cloudflare build image that builds `packages/examples/cloudflare` ships Bun 1.2.15, which refuses a `lockfileVersion: 2` lockfile — `bun install --frozen-lockfile` stops at `Unknown lockfile version` — and Bun 1.4.2 writes version 2 on a plain `bun install`, so a locally rewritten lockfile breaks that build without a line of source changing.

- Regenerate with the image's Bun: 1.2.x writes version 1, which every later Bun reads, so only the header and format change.
- Or set `BUN_VERSION` in the Cloudflare project to the version this repository develops against and keep the version 2 file.

`bun install --frozen-lockfile` never rewrites the header, so CI and a disposable checkout are safe either way; a plain `bun install` changes it. CI fails if the header stops being version 1: the `lockfile` job in `.github/workflows/ci.yml` parses `lockfileVersion` from the JSON-with-comments file and refuses any other value. Before changing a file, read [docs/architecture.md](architecture.md): it maps the layer regions, the five dependency rules between the packages, the frozen builtin surface and the bundle ceilings.

The adapter builds against two Nest majors: the suite runs against the lockfile's version, and CI's compatibility job installs Nest 11 and 12 — every `@nestjs/*` package moves together, because a mixed install is what a gateway or microservice case would fail on, not the adapter. The private benchmark suite joins that install rather than keeping its own copy: `packages/benchmarks` declares its `@nestjs/*` dependencies as ranges (`>=11 <13`), so the same `bun add` moves it too; an exact pin leaves a second Nest nested under `packages/benchmarks/`, and two copies of `AbstractHttpAdapter` are not assignable to each other. `bun add` rewrites `package.json` and `bun.lock`, so run the check in a disposable checkout or restore both first. The tests are transpiled from the root `tsconfig.json`, which turns `experimentalDecorators` and `emitDecoratorMetadata` on for the fixtures (Nest controllers with legacy decorators); the library declares no decorator, so neither flag changes `bun run build`.

The private compatibility suite joins that install too, and is where the adapter is proved against the third-party Nest packages it has to run alongside: `packages/compatibility` declares its `@nestjs/*` dependencies as ranges the matrix moves. It holds two kinds of proof — the boot-and-route cases this workspace adds, and the deeper behaviour suites moved out of `packages/core/test`, so every third-party package is proved in one place. Three of the packages it holds — `@nestjs/devtools-integration`, `@nestjs/authentication` and `@nestjs/authorization` — peer `^12` alone, so the 11 line removes them from that package and their cases skip rather than fail to load. The matrix, the suite and the reasoning behind what each case connects to are in [packages/compatibility/README.md](../packages/compatibility/README.md).

```sh
bun add --exact @nestjs/common@11.x @nestjs/core@11.x @nestjs/websockets@11.x @nestjs/microservices@11.x @nestjs/testing@11.x
bun run check && git restore package.json bun.lock && bun install --frozen-lockfile
```

## Release

Releases run through [release-please](https://github.com/googleapis/release-please). Six packages release from `packages/`: the adapter at `packages/core` (`@ailura/nestjs-hono-adapter`); the capability `@ailura/nestjs-platform-hono-multipart`; and the bridges `@ailura/nestjs-platform-hono-graphql`, `@ailura/nestjs-platform-hono-serve-static`, `@ailura/nestjs-platform-hono-socket-io` and `@ailura/nestjs-platform-hono-ws`. `release-please-config.json` declares one component per package — `packages/core`, plus `socket-io`, `ws`, `multipart`, `graphql` and `serve-static` — and `.release-please-manifest.json` records each last released version, which is the version its `package.json` declares: release-please reads the manifest as the last release and writes the next version into `package.json`. On every push to `main`, release-please opens a release pull request per package with its version bump and generated changelog; merging one creates that package's tag and GitHub release. The adapter is tagged `vX.Y.Z`; every other package sets `include-component-in-tag`, so their tags are `socket-io-vX.Y.Z`, `ws-vX.Y.Z`, `multipart-vX.Y.Z`, `graphql-vX.Y.Z` and `serve-static-vX.Y.Z`. Nothing is published directly, so a release is a reviewed change, and a release pull request is exempt from the policy gates by its head ref. Merging one publishes that package to npm: the GitHub release fires `.github/workflows/publish.yml`, which resolves the package directory from the tag (`v*` → `packages/core`, `socket-io-v*` → `packages/socket-io`, `ws-v*` → `packages/ws`, `multipart-v*` → `packages/multipart`, `graphql-v*` → `packages/graphql`, `serve-static-v*` → `packages/serve-static`), checks out the tag, builds with `bun run build`, and runs `npm publish <directory> --provenance` under OIDC trusted publishing, so no npm token is stored anywhere. One order matters and no configuration enforces it: the adapter must be published before the packages that peer on it (`multipart`, `graphql` and `serve-static` require it, `socket-io` and `ws` take it as an optional peer), so publish the adapter's release first.

## License

MIT
