# Support Policy

## Supported Versions

| Version | Supported | Security Fixes | Bug Fixes |
| ------- | --------- | -------------- | --------- |
| 2.x     | Yes       | Yes            | Yes       |
| 1.x     | No        | No             | No        |

Only the 2.x line receives security and maintenance updates. Upgrade to the latest 2.x release.

## Types of Support

- **Security fixes**: Critical and high-severity vulnerabilities in the 2.x line
- **Bug fixes**: Functional defects reported via GitHub Issues in the 2.x line
- **Compatibility updates**: Support for new NestJS major versions (11, 12) and Hono releases

## Getting Support

- **Bugs**: Open a [GitHub issue](https://github.com/ailuracollective/nestjs-hono-adapter/issues) with a minimal reproduction
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md) — do not open public issues
- **Questions**: Open a [GitHub discussion](https://github.com/ailuracollective/nestjs-hono-adapter/discussions)

## Out of Scope

- Third-party package issues (report to the upstream maintainers)
- Application-level bugs (bugs in the user's NestJS code, not the adapter)
- Integration issues with unsupported NestJS versions
- Performance issues not reproducible against the benchmark suite

## End of Life

When the 2.x line reaches end of life, this file will be updated to remove it from the supported table. Security fixes are provided for the latest minor release in the supported line. No backports to older minors.
