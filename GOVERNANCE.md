# Governance

## Roles and Responsibilities

### Maintainers

Maintainers have write access to the repository and are responsible for:

- Reviewing and merging pull requests
- Cutting releases via release-please
- Enforcing the contribution workflow (branch naming, commit conventions, PR template)
- Triaging issues and security reports
- Maintaining the architecture documentation

Current maintainers:

- [@SiddharthaGF](https://github.com/SiddharthaGF) — sole maintainer, code owner per [CODEOWNERS](CODEOWNERS)

### Contributors

Contributors are anyone who proposes changes via pull requests. They must:

- Follow the branch naming convention: `<github-username>/<type>/<description>`
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- Open a pull request using the template for its type
- Link the issue with a closing keyword (`Closes #N`); the issue must carry `status/ready`
- Apply exactly one `type/*` label
- Pass all CI checks

### Elevated access

Elevated access is: write access to this repository, access to the Actions secrets, the npm trusted-publishing trust binding, or the ability to approve a merge.

Nobody receives elevated access without review:

1. The maintainer proposes the collaborator to the organization owner, stating the access needed and why.
2. The organization owner confirms the collaborator's identity — the account must show a verifiable association with a known party (a commit history in this repository, a public association with the project, or a vouch from an existing trusted contributor).
3. Only after that confirmation is the collaborator added. Unconfirmed requests are refused.
4. Access is the lowest privilege that satisfies the need: read for reviewing, write for committing, and the Actions secrets only for a workflow that genuinely needs them.
5. Access is revoked when the work ends, or immediately on any sign of compromise.

Merge approval is itself an elevated act and is gated the same way: branch protection on `main` requires one approving review that is **not** the author's own commit, so a change can never merge on the strength of the person who wrote it.

## Decision Making

The project maintainer makes final decisions on architectural direction, release timing, and security responses. Decisions are documented in pull request reviews and issue threads.

## Security Contact

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process.
