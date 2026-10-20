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

`bun install --frozen-lockfile` never rewrites the header, so CI and a disposable checkout are safe either way; a plain `bun install` changes it. CI fails if the header stops being version 1: the `lockfile` job in `.github/workflows/lockfile.yml` parses `lockfileVersion` from the JSON-with-comments file and refuses any other value. Before changing a file, read [docs/architecture.md](architecture.md): it maps the layer regions, the five dependency rules between the packages, the frozen builtin surface and the bundle ceilings.

The adapter builds against two Nest majors: the suite runs against the lockfile's version, and CI's compatibility job installs Nest 11 and 12 — every `@nestjs/*` package moves together, because a mixed install is what a gateway or microservice case would fail on, not the adapter. The repository declares a range rather than a version (`^12.x` for the line it is on), so the lockfile holds the exact version a resolution chose and a fresh resolution takes the last available release of the line. The private benchmark suite joins that install rather than keeping its own copy: `packages/benchmarks` declares its `@nestjs/*` dependencies as ranges (`>=11 <13`), so the same `bun add` moves it too; an exact pin leaves a second Nest nested under `packages/benchmarks/`, and two copies of `AbstractHttpAdapter` are not assignable to each other. `bun add` and `bun update` rewrite `package.json` and `bun.lock`, so run the check in a disposable checkout or restore both first. The tests are transpiled from the root `tsconfig.json`, which turns `experimentalDecorators` and `emitDecoratorMetadata` on for the fixtures (Nest controllers with legacy decorators); the library declares no decorator, so neither flag changes `bun run build`.

The private compatibility suite joins that install too, and is where the adapter is proved against the third-party Nest packages it has to run alongside: `packages/compatibility` declares its `@nestjs/*` dependencies as ranges the matrix moves, or as exact pins where one version serves both Nest majors. It holds two kinds of proof — the boot-and-route cases this workspace adds, and the deeper behaviour suites moved out of `packages/core/test` — so the third-party packages the adapter runs alongside are proved in one workspace. Three of the packages it holds — `@nestjs/devtools-integration`, `@nestjs/authentication` and `@nestjs/authorization` — peer `^12` alone, so the 11 line removes them from that package and their cases skip rather than fail to load. The matrix runs the move in that package and not only at the root: a root `bun add` rewrites the root's specifiers alone and leaves the suite resolving the lockfile's major, which is the mixed install the matrix exists to catch. The `bun add` sets the range and the `bun update` that follows moves it to the last available release of the line, because a range the tree already satisfies is not re-resolved by an install. It then lays the tree out once more from the lockfile, because the add is incremental — it leaves the copies it nested under the other major in place, and a plain `bun install` does not prune them. The matrix, the suite and the reasoning behind what each case connects to are in [packages/compatibility/README.md](../packages/compatibility/README.md).

```sh
bun add @nestjs/common@^11.x @nestjs/core@^11.x @nestjs/websockets@^11.x @nestjs/graphql@^13.x @nestjs/apollo@^13.x @nestjs/serve-static@^5.x
(cd packages/compatibility && bun add @nestjs/common@^11.x @nestjs/core@^11.x @nestjs/websockets@^11.x @nestjs/microservices@^11.x @nestjs/testing@^11.x @nestjs/cqrs@^11.x @nestjs/swagger@^11.x)
bun update @nestjs/common @nestjs/core @nestjs/websockets @nestjs/platform-ws @nestjs/platform-socket.io @nestjs/graphql @nestjs/apollo @nestjs/serve-static
(cd packages/compatibility && bun update @nestjs/common @nestjs/core @nestjs/websockets @nestjs/microservices @nestjs/testing @nestjs/cqrs @nestjs/swagger)
rm -rf node_modules packages/*/node_modules && bun install
bun run check && git restore package.json bun.lock packages/compatibility/package.json && bun install --frozen-lockfile
```

### The nightly upstream watch

The compatibility matrix above moves to the last available release of each line whenever CI runs, but CI runs when something is pushed. `.github/workflows/upstream.yml` closes the gap: at midnight UTC it compares the version the lockfile resolved with the last available release of `hono` and `@nestjs/core` — the registry's `latest` tag, the one an install takes, which a prerelease never is. The repository declares a range rather than a version (`^12.x`, `^4.13.8`), so the range says what it accepts and the lockfile says what it has: a last available version the range takes is a release the suite has to answer for, and one it does not take — a new major — is a report in the run summary, because the range has to be widened first. The canary installs the last available release of the packages the range takes and keeps the resolved version of the ones it does not, so a failure it reports is a failure of a release the repository declares; a run by hand installs the last available release of every package, whatever the range says. The canary then runs the matrix's install against it, lays the tree out once more from the lockfile, and runs the suite; the bundle ceilings are not part of it, since the size gate ignores the packages the watch moves. The watch keeps running every night while the lockfile holds an older version, and the workflow also runs by hand.

A failing run opens a `fix:` issue, named after the release and holding the failing tests, following the sections of `bug.yml` and the labels `type/bug`, `status/needs-review` and `meta/dependency`. The report runs in its own job, which never executes the upstream code and holds the only permission to write, and Kitty authors the issue through the repository's `AILURA_UPSTREAM_TOKEN` — the workflow's own token would leave the author as `github-actions[bot]`, which nobody can edit. One issue is opened per release, and the log the report quotes is written by the upstream code, so it is quoted as text and never as markup. The reproduction the issue carries is the canary's own install, so the tree it names is the mixed one the suite fails on.

The watch lives in `scripts/upstream/` — `detect.ts` reads the registry, `report.ts` opens the issue, each with its test beside it — and the workflow only says when to run them. Taking the last available version is a two-step move, because `bun update` writes the exact version back for the packages it names and the range is what the watch reads:

```sh
bun update @nestjs/common @nestjs/core @nestjs/websockets @nestjs/platform-ws @nestjs/platform-socket.io
bun add @nestjs/common@^12.x @nestjs/core@^12.x @nestjs/websockets@^12.x @nestjs/platform-ws@^12.x @nestjs/platform-socket.io@^12.x
```

### The code graph

The repository carries a code graph: a local index of the symbols, the call paths and the blast radius of every file, built by the `codegraph` CLI and read by the agents that work on it through the codegraph MCP server. The index is local — `.codegraph/` is git-ignored — but the configuration that decides what goes into it is versioned: `codegraph.json` at the repository root, which a fresh clone reads on its first `codegraph init`.

`codegraph.json` carries two lists. `exclude` names paths kept out of the index even when they are git-tracked: `.github/` and `scripts/`, which hold the workflows and the repository's own scripts — the build a push decides on and the nightly watch — and contribute no symbol to the graph. `deprioritize` names the paths that stay in the index but never outrank the source: the examples, the benchmark and compatibility suites, and the test trees. The test trees stay because they carry the map from a symbol to the test that covers it — the edges a change has to finish — while being ranked below the source, because a test fixture is never the thing a reader is looking for.

```sh
codegraph init    # build the index
codegraph index   # rebuild it after changing codegraph.json
codegraph status  # what the index holds
```

The MCP server resolves the project from the directory it was launched in, so an agent that queries a checkout other than that one names the project in the call — `projectPath` — or the answer comes from the other tree.

## Release

Releases run through [release-please](https://github.com/googleapis/release-please). Six packages release from `packages/`: the adapter at `packages/core` (`@ailura/nestjs-hono-adapter`); the capability `@ailura/nestjs-platform-hono-multipart`; and the bridges `@ailura/nestjs-platform-hono-graphql`, `@ailura/nestjs-platform-hono-serve-static`, `@ailura/nestjs-platform-hono-socket-io` and `@ailura/nestjs-platform-hono-ws`. `release-please-config.json` declares one component per package — `packages/core`, plus `socket-io`, `ws`, `multipart`, `graphql` and `serve-static` — and `.release-please-manifest.json` records each last released version, which — once a package has shipped — is the version its `package.json` declares: release-please reads the manifest as the last release and writes the next version into `package.json`. A package that has never shipped carries the `0.0.0` sentinel instead, which is not a release to bump: release-please cuts its first version from the top-level `initial-version` (`0.1.0-beta` here) rather than from the adapter's major. On every push to `main`, release-please opens a release pull request per package with its version bump and generated changelog; merging one creates that package's tag and GitHub release. The adapter is tagged `vX.Y.Z`; every other package sets `include-component-in-tag`, so their tags are `socket-io-vX.Y.Z`, `ws-vX.Y.Z`, `multipart-vX.Y.Z`, `graphql-vX.Y.Z` and `serve-static-vX.Y.Z`. Nothing is published directly, so a release is a reviewed change, and a release pull request is exempt from the policy gates by its head ref. Merging one publishes that package to npm: the GitHub release fires `.github/workflows/publish.yml`, which resolves the package directory from the tag (`v*` → `packages/core`, `socket-io-v*` → `packages/socket-io`, `ws-v*` → `packages/ws`, `multipart-v*` → `packages/multipart`, `graphql-v*` → `packages/graphql`, `serve-static-v*` → `packages/serve-static`), checks out the tag, builds with `bun run build`, and runs `npm publish <directory> --provenance` under OIDC trusted publishing, so no npm token is stored anywhere. One order matters and no configuration enforces it: the adapter must be published before the packages that peer on it (`multipart`, `graphql` and `serve-static` require it, `socket-io` and `ws` take it as an optional peer), so publish the adapter's release first.

### Pre-release channel

A beta pre-release runs the same reviewed flow with the pre-release keys set. `release-please-config.json` gives `prerelease`, `prerelease-type` and `versioning` to every package — `packages/core` and the five capability and bridge packages — so each proposes a version carrying the prerelease part and creates a pre-release GitHub release. Every package has shipped, so each manifest entry is its real version and each bumps from there; the adapter itself, whose manifest entry is its real `2.0.2`, bumps from there (`2.1.0-beta` after a `feat`, the run after it `2.1.0-beta.1`). A package that had never shipped would start from the `0.0.0` sentinel instead, its first version the top-level `initial-version`, `0.1.0-beta`, not a bump of the adapter's major. `.github/workflows/publish.yml` reads the pre-release flag and adds `--tag next`, so every beta lands on the `next` dist-tag, `latest` keeps the last stable release, and a package that has never shipped is `next`-only until its first stable release; a deployment opts in with `npm install @ailura/nestjs-hono-adapter@next`. To close the channel, keep `"versioning": "prerelease"` and `"prerelease-type": "beta"` for those packages in `release-please-config.json`, set `"prerelease": false`, and merge. The next release pull request removes the beta suffix (for example, `2.1.0-beta.1` becomes `2.1.0`) and creates a stable GitHub release, which the publish workflow sends to npm `latest`. Only after that release is merged and `.release-please-manifest.json` records the stable version should you remove `prerelease`, `prerelease-type` and `versioning` to resume normal stable versioning. A version carrying a prerelease part satisfies no plain range, so the packages that require the adapter name the beta lines in their peer range while the channel is open — `>=2 <3 || >=2.1.0-beta <3`, the second line being what a `feat` release cuts from `2.0.2` — and go back to `>=<the released version> <3` once the final is out; `ws` and `socket-io` take the adapter as an optional peer, which npm warns about rather than refuses, so their range stays where it is. A breaking change cuts the next major instead, and a beta of it fits no range here: the dependents' peer range and its upper bound move to the new major in the same change.

## License

MIT
