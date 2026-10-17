# Contributing

## Getting started

```sh
bun install --frozen-lockfile
```

## Workflow

1. **Fork** the repository
2. **Branch**: `<github-username>/<type>/<description>` (all lowercase)
3. **Commit**: follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat:`, `fix:`, `chore:`)
4. **Sign-off**: every commit must include a `Signed-off-by:` line — use `git commit -s` (see [DCO.md](DCO.md))
5. **Open a PR** using the template for its type, link the issue with a closing keyword, apply exactly one `type/*` label, and let the checks pass

Steps 2, 3 and 5 are the organisation's rules; they are written once in [.agents/organization-conventions.md](.agents/organization-conventions.md#pull-requests) and not repeated here.

## Code standards

`bun run check` runs the whole gate — lint, format, typecheck, test, build and the size gate — and one step alone is `bun run <lint|format|format:check|typecheck|test|build|size>`. [docs/development.md](docs/development.md#development) has the environment they need.

Code is formatted with `oxfmt` and linted with `oxlint`. Do not bypass these. Git hooks (installed by `bun install`) run lint-staged on commit and validate Conventional Commits on the message.

## Requirements for acceptable contributions

- Every PR must include tests that cover the change
- Type-specific linting is enforced (e.g., `type/task` for tooling changes)
- Documentation must be updated when public behavior or configuration changes
- Architecture rules (layer boundaries) must be respected — see [docs/architecture.md](docs/architecture.md)
- The size gate (bundle ceilings in `.size-limit.json`) must pass

## Running the tests

### Locally

```sh
bun test                    # the whole suite
bun test packages/core/test # one package's behaviour suite
bun test test/layers.test.ts # one file
```

Every test uses `bun test` directly — there is no separate test runner to configure. The suite is deterministic and needs no network access; a run that reaches the network is a bug in the test.

### In CI

| Workflow | What runs | When |
| --- | --- | --- |
| `.github/workflows/ci.yml` (`check`) | `bun run check` — lint, format, typecheck, test, build, size | Every push and PR |
| `.github/workflows/ci.yml` (`compat`) | `bun run typecheck && bun run build && bun test` on NestJS 11 and 12 | Every PR |
| `.github/workflows/security.yml` | gitleaks (secret scan) | Every push and PR |
| `.github/workflows/security.yml` | dependency review | Every PR |

### What the tests cover

Behaviour suites live under `packages/*/test/`, one per package, and the guards that protect the monorepo are listed with what each one holds in [docs/architecture.md](docs/architecture.md#where-the-guards-live). Beyond those, `packages/compatibility/` is the suite that proves the adapter serves an application built with each third-party Nest package it runs alongside.

### Reading the results

A failing `test` step names the file and the assertion. A failing `size` step names the entrypoint and the ceiling it exceeded. A failing `compat` job names the Nest major it ran against — the matrix comment in `ci.yml` explains which packages move with each major.

## Test policy for significant changes

A change is **significant** when it alters any of:

- request decoding, response encoding, or the lifecycle bridge
- a layer boundary or an import rule in `test/layers.test.ts`
- a published entrypoint's exports
- a compatibility bridge's shim behaviour
- a bundle that has a size ceiling

A significant change **must** add or update tests in the same pull request. A significant change without a test does not pass review.

For a change that is not significant — a documentation edit, a comment, a dependency bump with no behaviour change — add a test only if the existing suite does not already cover the path the change touches.

## Review process

1. A maintainer reviews the PR
2. Automated checks (CI, compat matrix, security scans) must pass
3. The maintainer approves and merges
4. release-please cuts the release when the merge lands on `main`

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process. Do not open public issues for security vulnerabilities.
