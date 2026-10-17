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

### Decision Making

The project maintainer makes final decisions on architectural direction, release timing, and security responses. Decisions are documented in pull request reviews and issue threads.

## Security Contact

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process.
