# Security Policy

## Reporting a Vulnerability

Report vulnerabilities in this project privately before disclosing them publicly.

### How to report

Open a [GitHub security advisory](https://github.com/ailuracollective/nestjs-hono-adapter/security/advisories/new) or email the maintainers at security@ailuracollective.com.

Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- Any known mitigations or workarounds

### What to expect

- We will acknowledge your report within **7 days**
- We will investigate and provide an initial assessment within **14 days**
- We will notify you when the vulnerability is fixed and coordinate disclosure

### Scope

Security issues in this project include:

- Remote code execution or injection vulnerabilities
- Authentication or authorization bypasses
- Data leakage or privacy violations
- Dependency vulnerabilities (report these to the dependency's maintainers first)

### Out of scope

- Issues in third-party dependencies (report upstream)
- Denial of service attacks that require sustained resource consumption
- Social engineering attacks
- Physical attacks on infrastructure

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |

Only the 2.x line receives security fixes. Upgrade to the latest 2.x release. See [SUPPORT.md](SUPPORT.md) for the full support scope and duration.

## When Releases Stop Receiving Security Updates

Security updates end for a release when a newer minor release of the same major line is published — the older minor is no longer patched and a consumer on it must upgrade. When a whole major line ends support, this table is updated to remove it and `SUPPORT.md` records the change. The end of the 2.x line will be announced in the release notes and in this file at least **30 days** before it happens.

## Secret Management

Secrets and credentials used by this project are managed as follows:

- **Storage**: all CI credentials live as GitHub Actions secrets (`AILURA_RELEASE_TOKEN`, `AILURA_PR_COMPLIANCE_TOKEN`, the npm OIDC trust binding). Nothing sensitive is stored in the repository, in a workflow file, or in any package.
- **Access**: a secret is available only to the workflow that declares it. Read-only workflows (`contents: read`) cannot read release or publish secrets; `publish.yml` is the only workflow with `id-token: write` for npm OIDC.
- **Rotation**: the release token is rotated on the maintainer's schedule and immediately on any suspicion of compromise. npm publication does not use a stored npm token at all — it uses a short-lived OIDC token minted per run.
- **Detection**: `.gitleaks.toml` configures gitleaks, which runs on every push and pull request via `.github/workflows/security.yml` and blocks a merge that would commit a credential.
- **Local development**: `.env*` is git-ignored; credentials for local runs are supplied by the developer through the environment and never written to a tracked file.

## License

This security policy is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
