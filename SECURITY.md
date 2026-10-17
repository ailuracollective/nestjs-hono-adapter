# Security policy

## Reporting a vulnerability

A vulnerability is reported privately, and disclosed only once a fix has shipped. The report is filed as a [GitHub security advisory](https://github.com/ailuracollective/nestjs-hono-adapter/security/advisories/new) or sent to security@ailuracollective.com, and carries:

- the vulnerability and its potential impact
- the steps to reproduce it, or a proof of concept
- any known mitigation or workaround

A report is acknowledged within seven days and assessed within fourteen. The maintainer tells the reporter when the fix ships and coordinates the disclosure with them.

### In scope

- remote code execution, or an injection of any kind
- an authentication or authorization bypass
- data leakage, or a privacy violation
- a vulnerability in a dependency, which goes to that dependency's maintainers first

### Out of scope

- a third-party dependency's own issue, reported upstream
- a denial of service that needs sustained resource consumption
- social engineering
- a physical attack on infrastructure

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |

Only the 2.x line receives security fixes, and a fix ships in the latest 2.x release. [SUPPORT.md](SUPPORT.md) carries the full support scope and its duration.

## When a release stops receiving updates

Security updates end for a release the moment a newer minor of the same major ships: the older minor is no longer patched, and a consumer on it upgrades. A major line ends the same way — its row leaves the table above and [SUPPORT.md](SUPPORT.md) records the change — announced in the release notes and in this file at least thirty days ahead.

## Secrets in CI

- **Storage**: every credential lives as a GitHub Actions secret — `AILURA_RELEASE_TOKEN`, `AILURA_PR_COMPLIANCE_TOKEN`, the npm OIDC trust binding. Nothing sensitive is stored in the repository, in a workflow file, or in any package.
- **Access**: a secret reaches only the workflow that declares it. A read-only workflow (`permissions: contents: read`) cannot read the release or publish secrets, and `publish.yml` is the only one holding `id-token: write` for npm.
- **Rotation**: the release token turns on the maintainer's schedule, and immediately on any suspicion of compromise. npm publication stores no npm token at all — it mints a short-lived OIDC token per run.
- **Detection**: `.gitleaks.toml` drives the `gitleaks` job in `.github/workflows/security.yml`, which scans the history with the gitleaks CLI on a push to `main` and on a pull request touching `packages/`, `test/`, `scripts/` or `.github/workflows/`. A finding fails the job and blocks the merge, reported in the job log rather than as a comment on the pull request. The `dependency-review` job runs on every pull request and fails on a high-severity dependency change.
- **Local development**: `.env*` is git-ignored, and a credential for a local run arrives through the environment and is never written to a tracked file.

## License

This security policy is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
