# AGENTS.md — instructions for agents working in this repository

This repository is `@ailura/nestjs-hono-adapter`, a NestJS HTTP
adapter that runs a NestJS application on Hono. Agents working
here read this file before editing anything.

## Organization standards

**Mandatory. Read it before anything else in this file.**

The organisation's conventions live in
[.agents/organization-conventions.md](.agents/organization-conventions.md)
and apply to every repository in the organisation. Do not paste
them here or restate them from memory — a rule absent from that
file is not an organisation rule. If it is not there, search the
repository before concluding it is absent, use it where found,
and record the path in § Additional references; if it is nowhere
in the repository, stop and say so rather than reconstruct it.

Organisation standards apply here unless this repository
documents an exception in § Repository-specific conventions,
carrying the reason it was taken. An exception nobody wrote down
is not an exception.

## Defaults

The repository ships with the standard and its gate. Link them,
do not restate them:

- [.agents/organization-conventions.md](.agents/organization-conventions.md)
  — mandatory.
- [.github/workflows/policy.yml](.github/workflows/policy.yml) —
  the gate; complete and intact.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — CI;
  bun-based checks, size gate, NestJS compat matrix.
- [.github/workflows/release.yml](.github/workflows/release.yml)
  — release-please, npm published through OIDC trusted
  publishing.
- [.github/ISSUE_STANDARD.md](.github/ISSUE_STANDARD.md),
  [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/),
  [.github/PULL_REQUEST_TEMPLATE/](.github/PULL_REQUEST_TEMPLATE/),
  [.github/labels.yml](.github/labels.yml),
  [.github/CODEOWNERS](.github/CODEOWNERS) — the standard
  artifacts.

## Repository scope

This file covers the whole repository. The directories an agent
may edit:

- `packages/` — the workspace packages: `core`, published as
  `@ailura/nestjs-hono-adapter`, and the optional capabilities
  `ws`, `socket-io` and `multipart`, published as
  `@ailura/nestjs-platform-hono-{ws,socket-io,multipart}`. It
  also holds `benchmarks`, the private comparison suite — one
  Nest application served by the Hono adapter on Bun and Node
  and by the official Express and Fastify platform adapters,
  driven by `oha` and `bombardier`. It is never published; its
  own build is not part of `bun run check`, which lints, formats
  and typechecks it. Run it by hand with `bun run bench`.
- `test/` — what guards the monorepo and what more than one
  package shares: `layers.test.ts`, `entry-points.test.ts`,
  `node-builtins.test.ts`, plus the shared probe and helpers
  (`probe.ts`, `bun-adapter.ts`, `bun-bindings.ts`). Each
  package carries its own behaviour tests under
  `packages/<name>/test/` and its own `test` script.
- `docs/` — architecture and documentation.
- `examples/` — runnable Cloudflare Workers examples, one per
  transport that runs on a Worker.

An agent must not touch `dist/`, `node_modules/`, or `bun.lock`
(except via `bun install`). There is no subdirectory
`AGENTS.md`; this file governs every path.

## Repository context

An HTTP adapter that lets a NestJS application run on Hono
instead of Express or Fastify. It implements the Nest 11/12
`AbstractHttpAdapter` contract directly on Hono: routes are
registered on a Hono application, and Hono's Web `Request` and
`Response` are translated to and from the objects Nest reads and
writes. The stack is Bun, TypeScript (strict), Hono 4 and NestJS
11/12.

The core is runtime-neutral: a `Transport` serves through Bun's
own server, `@hono/node-server`, or a fetch host's Web
`Request`/`Response`; each transport lives behind its own
subpath, and a bootstrap that names none gets Bun's own server,
so a deployment on Node names `nodeServer()`.
`@ailura/nestjs-hono-adapter` publishes four entrypoints: `.`
(the adapter), `./bun-server`, `./node-server` and `./fetch`.
Each optional capability is a single-entrypoint package —
WebSockets in `@ailura/nestjs-platform-hono-ws`, uploads in
`@ailura/nestjs-platform-hono-multipart`, and Socket.IO in
`@ailura/nestjs-platform-hono-socket-io` — and the adapter names
none of them.

GraphQL is deliberately **not** one of those packages: it ships
as `@ailura/nestjs-platform-hono-graphql`, which patches one
branch of `@nestjs/apollo`'s own `ApolloDriver`, so a deployment
names the stock driver. `@nestjs/serve-static` is the same, in
`@ailura/nestjs-platform-hono-serve-static`. Both are
**compatibility bridges** rather than capabilities, and the
difference is how they arrive: a capability is imported, a
bridge is not. `compat/registry/discover.ts` resolves each name
in `BRIDGE_PACKAGES` out of the application's own tree, so
installing the package is what installs the bridge and an
application writes no import of either. The adapter names none
of the packages, and the bridge packages peer on it.

The adapter's implementation is `packages/core`: `src/core/`
holds the request decode, response encode, and lifecycle bridge,
plus the `Server` and `Transport` ports; `src/features/` holds
the optional capabilities (CORS, guards, instrumentation hooks,
SSE, static assets, views); `src/compat/` holds the region's
mechanism — the `Bridge` port, the registry, the peer loader,
the discovery — and the one bridge that cannot be optional,
Express's response surface and error middleware; `src/servers/`
holds the runtime transports (`bun.ts`, `node.ts`, `fetch.ts`),
reached through their subpaths — the Bun one also from
`core/server/server-adapter.ts`, the composition root and the
default transport. The repository root is only the private Bun
workspace root: no published package, no `src/`, no exports. The
layout, import rules, and bundle ceilings are in
[docs/architecture.md](docs/architecture.md); the compatibility
region is covered in
[docs/compatibility.md](docs/compatibility.md).

## Repository-specific conventions

- **Releases use release-please with OIDC trusted publishing.**
  release-please opens one combined pull request for packages
  with pending releases on every push to `main`; merging it
  creates the tags and GitHub releases for those packages,
  authored by the AiluraKitty account through
  `AILURA_RELEASE_TOKEN`. The release fires
  `.github/workflows/publish.yml`, which publishes to npm with a
  short-lived OIDC token (no stored npm token). See
  `release-please-config.json` and
  `.github/workflows/release.yml`.
- **The toolchain is Bun.** Install, test, and build run through
  Bun; `bun install --frozen-lockfile` is the only supported
  install command. `bun.lock` stays at `lockfileVersion: 1` —
  the Cloudflare build image reads no other — and CI fails when
  it changes; see
  [docs/development.md](docs/development.md#the-lockfile-format-the-build-image-reads).
- **The issue contract is prose only.** This repository carries
  `.github/ISSUE_STANDARD.md` but not `.github/CONTRACT.yml` or
  `scripts/validate_contract.py`: no tool validates the
  templates against the contract file, so the issue standard is
  the human-readable reference and the templates implement it.
- **The size gate is a product constraint.** Each public
  entrypoint is bundled the way a consumer resolves it, and CI
  fails when a ceiling in a package's `.size-limit.json` is
  exceeded. Each package carries its own beside its
  `package.json`. This is a gate, not a report.
- **A compatibility bridge is small on purpose.** The region and
  each bridge package's `src/` cap at 100 lines, where the
  repository's own ceiling is 400, and a comment is at most two
  lines: the reasoning lives in
  [docs/compatibility.md](docs/compatibility.md), not beside the
  code it explains. `test/layers.test.ts` holds the seventh
  rule, that a bridge package reaches the adapter only through
  the published entrypoint.
- **The compat matrix tests NestJS 11 and 12 on Bun.** Every
  Nest package moves together; a mixed install is what a
  WebSocket, microservice or bridge case would fail on.
- **`packages/benchmarks/` is private and never published.** It
  is a workspace package like the others, so `bun run check`
  lints, formats and typechecks it; but it has no release entry
  — it is absent from `release-please-config.json`, from
  `.github/workflows/publish.yml` and from the size gate — and
  its own `tsc` build runs only when the suite does, by hand,
  with `bun run bench`.
- **`docs/benchmarks.md` is generated.** The private benchmark
  suite overwrites it on every `bun run bench`, so
  `.oxfmtrc.json` excludes it from the formatter, the way it
  excludes `CHANGELOG.md`; the raw samples stay under
  `packages/benchmarks/results/`, which is git-ignored.

## Development and validation

From a fresh clone:

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` is exactly what CI runs — lint, format check,
typecheck, test, build and the size gate, in sequence; a failure
in any step fails the whole command. The size gate fails when a
bundle ceiling in a package's `.size-limit.json` is exceeded.
The compat matrix in CI additionally runs
`bun run typecheck && bun run build && bun test` against NestJS
11 and 12 on Bun.

Individual commands:

```sh
bun run lint          # oxlint
bun run format        # oxfmt --write .
bun run format:check  # oxfmt --check .
bun run typecheck     # build:core, then tsc for test
bun run test          # build, then bun test
bun run build         # build:core, then build:packages
bun run size          # build, then each package's size-limit
```

## Git and pull requests

Branches are `<github-username>/<type>/<description>`, all
lowercase. The type is the title type, except `breaking-change`,
which is a commit marker and not a branch type. Commit messages
follow Conventional Commits; the allowed types are the filenames
of `.github/PULL_REQUEST_TEMPLATE/`, minus the default form.

A pull request must:

- Carry a title matching the template for its type.
- Link the issue with a closing keyword (`Closes #N`); the issue
  must carry `status/ready`.
- Apply exactly one `type/*` label.
- Pass all CI checks.

## Documentation

Documentation lives in `docs/` (architecture) and in the README.
A change to public behavior or configuration updates the
documentation in the same change. A generated changelog is not
edited by hand.

"Documented" means: a comment in the source for internal
contracts, a page in `docs/` for architecture and layering
rules, and a README section for user-facing behavior.

## Additional references

- [docs/architecture.md](docs/architecture.md) — the layer map,
  import rules, and Node boundary. Read before editing the
  adapter.
- [docs/compatibility.md](docs/compatibility.md) — the
  compatibility region: what a bridge is, how the region
  discovers a bridge package without an import, what each of the
  three bridges does, what the `init()` seam is for, and what a
  new bridge costs. Read before adding a shim or a platform call
  shape.
- [packages/core/.size-limit.json](packages/core/.size-limit.json)
  — the adapter's bundle ceilings; `packages/ws`,
  `packages/socket-io`, `packages/multipart`, `packages/graphql`
  and `packages/serve-static` each carry their own beside their
  `package.json`.
- [packages/benchmarks/README.md](packages/benchmarks/README.md)
  — the comparison suite and the methodology it follows.
- [release-please-config.json](release-please-config.json) — the
  release-please configuration.
- [.release-please-manifest.json](.release-please-manifest.json)
  — the last released version per package.
- [.github/workflows/publish.yml](.github/workflows/publish.yml)
  — npm publication with OIDC trusted publishing, fired by the
  release.
- [.github/standards.local.yml](.github/standards.local.yml) —
  this repository's declared deviations from the standard; it
  currently records none.

## Completion requirements

A repository's `AGENTS.md` is **valid** when every line below
holds. This is the baseline contract, not a placeholder: it is
not deleted when the file is completed.

- [ ] No `TODO` marker remains anywhere in the file.
- [ ] The organisation conventions reference resolves — either
      `.agents/organization-conventions.md` exists, or the path
      it was found at is recorded in § Additional references.
- [ ] Every file this document links to exists in this
      repository, at the path given.
- [ ] Every section above says something true of this
      repository, and nothing still says something that was only
      true of the template.
- [ ] Every departure from the organisation standards appears in
      § Repository-specific conventions with a reason.
- [ ] The commands in § Development and validation run in this
      repository exactly as written.

Check them by hand:

```sh
# 1. no unresolved placeholders
grep -n 'TODO' AGENTS.md                                    # expect no output

# 2. the organisation reference resolves, from any directory
git ls-files --full-name | grep -E '(^|/)organization-conventions\.md$'

# 3. every linked path exists
grep -oE '\]\([^)]+\)' AGENTS.md | tr -d ']()' | while read -r p; do
  [ -e "${p%%#*}" ] || echo "MISSING: $p"
done
```

This repository's definition of done: `bun run check` passes,
the size gate is within ceiling, and the compat matrix is green.
