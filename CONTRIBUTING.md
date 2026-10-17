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
5. **Open a PR** using the template for its type
6. **Link the issue** with a closing keyword (`Closes #N`); the issue must carry `status/ready`
7. **Apply one `type/*` label**
8. **Pass all CI checks**

## Code standards

- **Lint**: `bun run lint`
- **Format**: `bun run format`
- **Typecheck**: `bun run typecheck`
- **Test**: `bun run test`
- **Full check**: `bun run check` (lint + format + typecheck + test + build + size)

Code is formatted with `oxfmt` and linted with `oxlint`. Do not bypass these.

## Requirements for acceptable contributions

- Every PR must include tests that cover the change
- Type-specific linting is enforced (e.g., `type/task` for tooling changes)
- Documentation must be updated when public behavior or configuration changes
- Architecture rules (layer boundaries) must be respected — see [docs/architecture.md](docs/architecture.md)
- The size gate (bundle ceilings in `.size-limit.json`) must pass

## Review process

1. A maintainer reviews the PR
2. Automated checks (CI, compat matrix, security scans) must pass
3. The maintainer approves and merges
4. release-please cuts the release when the merge lands on `main`

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process. Do not open public issues for security vulnerabilities.
