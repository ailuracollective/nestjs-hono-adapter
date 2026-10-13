# AGENTS.md — instructions for agents working in this repository

This repository is `@ailura/nestjs-hono-adapter`, a NestJS HTTP
adapter that runs a NestJS application on Hono. Agents working
here read this file before editing anything.

---

## Organization standards

**Mandatory. Read it before anything else in this file.**

The organisation's conventions live in
[.agents/organization-conventions.md](.agents/organization-conventions.md),
not in this file. The link is mandatory and applies to every
repository in the organisation. Do not paste them here or
restate them from memory — if a rule is not in that file, it is
not an organisation rule.

If it is not there, search the whole repository before
concluding it is absent; use it where you find it and record the
path in § Additional references. If it is not in the repository
at all, stop and say so — do not reconstruct it.

Organisation standards apply here unless this repository
documents a specific exception, in § Repository-specific
conventions, carrying the reason it was taken. An exception
nobody wrote down is not an exception.

---

## Defaults

The repository ships with the standard and its gate. Link them,
do not restate them:

- [.agents/organization-conventions.md](.agents/organization-conventions.md)
  — mandatory.
- [.github/workflows/policy.yml](.github/workflows/policy.yml) —
  the gate; complete and intact.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — the
  repository's CI; bun-based checks, size gate, NestJS compat
  matrix.
- [.github/workflows/release.yml](.github/workflows/release.yml)
  — release-please, with npm published through OIDC trusted
  publishing.
- [.github/ISSUE_STANDARD.md](.github/ISSUE_STANDARD.md),
  [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/),
  [.github/PULL_REQUEST_TEMPLATE/](.github/PULL_REQUEST_TEMPLATE/),
  [.github/labels.yml](.github/labels.yml),
  [.github/CODEOWNERS](.github/CODEOWNERS) — the standard
  artifacts.

The stack is Bun + TypeScript; the adapter targets NestJS 11/12
on Hono 4.

## Repository scope

This file covers the whole repository. The directories that are
part of the repository and that an agent may edit:

- `packages/` — the workspace packages. `core` is the adapter,
  published as `@ailura/nestjs-hono-adapter` (layered into
  `packages/core/src/{core,features,servers}`; it publishes `.`,
  `./bun-server`, `./node-server` and `./fetch`). `ws`,
  `socket-io` and `multipart` are the three optional
  capabilities, published as `@ailura/nestjs-platform-hono-ws`,
  `@ailura/nestjs-platform-hono-socket-io` and
  `@ailura/nestjs-platform-hono-multipart`, one entrypoint each.
- `test/` — what guards the monorepo and what more than one
  package shares: `test/layers.test.ts`,
  `test/entry-points.test.ts` and `test/node-builtins.test.ts`,
  plus the shared probe and helpers (`test/probe.ts`,
  `test/bun-adapter.ts`, `test/bun-bindings.ts`). Each package
  carries its own behaviour tests under `packages/<name>/test/`
  and has its own `test` script.
- `docs/` — architecture and documentation.
- `examples/` — runnable Cloudflare Workers examples, one per
  transport that runs on a Worker.

An agent must not touch `dist/`, `node_modules/`, or `bun.lock`
(except via `bun install`). There is no subdirectory
`AGENTS.md`; this file governs every path.

## Repository context

This project is an HTTP adapter that lets a NestJS application
run on Hono instead of Express or Fastify. It implements the
Nest 11/12 `AbstractHttpAdapter` contract directly on Hono:
routes are registered on a Hono application, and Hono's Web
`Request` and `Response` are translated to and from the objects
Nest reads and writes.

The stack is Bun (runtime and package manager), TypeScript
(strict), Hono 4 (web framework), and NestJS 11/12 (the
framework being adapted). The core is runtime-neutral: a
`Transport` serves through Bun's own server,
`@hono/node-server`, or a fetch host's Web `Request`/`Response`;
each transport lives behind its own subpath, and a bootstrap
that names none gets Bun's own server, so a deployment on Node
names `nodeServer()`. The adapter,
`@ailura/nestjs-hono-adapter`, publishes four entrypoints: `.`
(the adapter), `./bun-server`, `./node-server` and `./fetch`.
Each optional capability is its own package with a single
entrypoint: WebSockets in `@ailura/nestjs-platform-hono-ws`,
uploads in `@ailura/nestjs-platform-hono-multipart` and
Socket.IO in `@ailura/nestjs-platform-hono-socket-io`.

The adapter's implementation is `packages/core`:
`packages/core/src/core/` holds the request decode, response
encode, and lifecycle bridge, plus the `Server` and `Transport`
ports; `packages/core/src/features/` holds optional capabilities
(CORS, guards, the instrumentation hooks, SSE, static assets,
views); `packages/core/src/servers/` holds the runtime
transports (`bun.ts`, `node.ts`, `fetch.ts`), reached through
their subpaths — and the Bun one from `core/server-adapter.ts`,
the adapter's composition root, as the transport it serves
through by default. The repository root is only the private Bun
workspace root: no published package, no `src/`, no exports. The
three capability packages live in `packages/` too and depend on
the adapter, which names none of them. The layout, import rules,
and bundle ceilings are written down in
[docs/architecture.md](docs/architecture.md).

## Repository-specific conventions

- **Releases use release-please with OIDC trusted publishing.**
  release-please opens one combined pull request for packages
  with pending releases on every push to `main`; merging it
  creates the corresponding tags and GitHub releases for those
  packages, authored by the AiluraKitty account through
  `AILURA_RELEASE_TOKEN`. The release then fires
  `.github/workflows/publish.yml`, which publishes to npm with a
  short-lived OIDC token (no stored npm token). See
  `release-please-config.json` and
  `.github/workflows/release.yml`.
- **The toolchain is Bun.** Install, test, and build all run
  through Bun; `bun install --frozen-lockfile` is the only
  supported install command. `bun.lock` stays at
  `lockfileVersion: 1` — the Cloudflare build image reads no
  other — and CI fails when it changes; see
  [docs/development.md](docs/development.md#the-lockfile-format-the-build-image-reads).
- **The issue contract is prose only.** This repository carries
  `.github/ISSUE_STANDARD.md` but not `.github/CONTRACT.yml` or
  `scripts/validate_contract.py`: no tool here validates the
  templates against the contract file, so the issue standard is
  the human-readable reference and the templates implement it.
- **The size gate is a product constraint.** Each public
  entrypoint is bundled the way a consumer resolves it, and CI
  fails when a ceiling in a package's `.size-limit.json` is
  exceeded. Each package carries its own beside its
  `package.json`. This is a gate, not a report.
- **The compat matrix tests NestJS 11 and 12 on Bun.** Every
  Nest package moves together; a mixed install is what a
  WebSocket or microservice case would fail on.

## Development instructions

From a fresh clone:

```sh
bun install --frozen-lockfile
```

Run the full check suite (lint, format check, typecheck, test,
build, size):

```sh
bun run check
```

Individual commands:

```sh
bun run lint          # oxlint
bun run format        # oxfmt --write .
bun run format:check  # oxfmt --check .
bun run typecheck     # build:core, then tsc for test
bun run test          # build:core, then bun test
bun run build         # build:core, then build:packages
bun run size          # build, then each package's size-limit
```

## Testing and validation

The checks this repository actually runs:

```sh
bun run check
```

This runs lint, format check, typecheck, test, build, and the
size gate in sequence. A failure in any step fails the whole
command. The size gate fails when a bundle ceiling in a
package's `.size-limit.json` is exceeded.

The compat matrix in CI additionally runs
`bun run typecheck && bun test && bun run build` against NestJS
11 and 12 on Bun.

## Git and pull requests

Branches are `<github-username>/<type>/<description>`, all
lowercase. The type is the title type, except `breaking-change`,
which is a commit marker and not a branch type.

Commit messages follow Conventional Commits. The allowed types
are the filenames of `.github/PULL_REQUEST_TEMPLATE/`, minus the
default form.

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
- [packages/core/.size-limit.json](packages/core/.size-limit.json)
  — the adapter's bundle ceilings; `packages/ws`,
  `packages/socket-io` and `packages/multipart` each carry their
  own beside their `package.json`.
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
- [ ] The commands in § Development instructions and § Testing
      and validation run in this repository exactly as written.

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
