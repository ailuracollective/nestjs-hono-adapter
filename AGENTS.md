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

- `src/` — the adapter source, layered into `core/` and
  `features/`.
- `test/` — the test suite, including fixtures and probes.
- `docs/` — architecture and lint-exception documentation.
- `examples/` — runnable examples (Cloudflare Workers).

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
framework being adapted). The package publishes two entrypoints:
`.` (the HTTP adapter) and `./ws` (the WebSocket adapter).

The source is layered: `src/core/` holds the request decode,
response encode, and lifecycle bridge; `src/features/` holds
optional capabilities (CORS, guards, SSE, static assets, views).
The layout, import rules, and bundle ceilings are written down
in [docs/architecture.md](docs/architecture.md).

## Repository-specific conventions

- **Releases use release-please with OIDC trusted publishing.**
  release-please opens a release pull request per push to
  `main`; merging it creates the tag and the GitHub release,
  authored by the AiluraKitty account through
  `AILURA_RELEASE_TOKEN`. The release then fires
  `.github/workflows/publish.yml`, which publishes to npm with a
  short-lived OIDC token (no stored npm token). See
  `release-please-config.json` and
  `.github/workflows/release.yml`.
- **The toolchain is Bun.** Install, test, and build all run
  through Bun; `bun install --frozen-lockfile` is the only
  supported install command.
- **The issue contract is prose only.** This repository carries
  `.github/ISSUE_STANDARD.md` but not `.github/CONTRACT.yml` or
  `scripts/validate_contract.py`: no tool here validates the
  templates against the contract file, so the issue standard is
  the human-readable reference and the templates implement it.
- **The size gate is a product constraint.** Each public
  entrypoint is bundled the way a consumer resolves it, and CI
  fails when a ceiling in `.size-limit.json` is exceeded. This
  is a gate, not a report.
- **The compat matrix tests NestJS 11 and 12 on Node 22
  and 24.** Every Nest package moves together; a mixed install
  is what a WebSocket or microservice case would fail on.

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
bun run typecheck     # tsc --noEmit for src and test
bun run test          # bun test
bun run build         # tsc -p tsconfig.json
bun run size          # build + size-limit
```

## Testing and validation

The checks this repository actually runs:

```sh
bun run check
```

This runs lint, format check, typecheck, test, build, and the
size gate in sequence. A failure in any step fails the whole
command. The size gate fails when a bundle ceiling in
`.size-limit.json` is exceeded.

The compat matrix in CI additionally runs
`bun run typecheck && bun test && bun run build` against NestJS
11 and 12 on Node 22 and 24.

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

Documentation lives in `docs/` (architecture, lint exceptions)
and in the README. A change to public behavior or configuration
updates the documentation in the same change. A generated
changelog is not edited by hand.

"Documented" means: a comment in the source for internal
contracts, a page in `docs/` for architecture and layering
rules, and a README section for user-facing behavior.

## Additional references

- [docs/architecture.md](docs/architecture.md) — the layer map,
  import rules, and Node boundary. Read before editing `src/`.
- [docs/lint-exceptions.md](docs/lint-exceptions.md) — the lint
  rules this repository disables and why.
- [.size-limit.json](.size-limit.json) — the bundle ceilings the
  size gate enforces.
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
