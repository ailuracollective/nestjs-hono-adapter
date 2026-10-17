# Support policy

## Supported versions

| Version | Supported | Security fixes | Bug fixes |
| ------- | --------- | -------------- | --------- |
| 2.x     | Yes       | Yes            | Yes       |
| 1.x     | No        | No             | No        |

Only the 2.x line receives security and maintenance updates, and an update ships in the latest 2.x release.

## What support covers

- **Security fixes**: a critical or high-severity vulnerability in the 2.x line.
- **Bug fixes**: a functional defect reported through [GitHub issues](https://github.com/ailuracollective/nestjs-hono-adapter/issues) in the 2.x line.
- **Compatibility**: the Nest majors the [compatibility matrix](packages/compatibility/README.md) runs — 11 and 12 — and the Hono releases the peer range accepts.

## Where to ask

- **A defect** is filed as an issue with a minimal reproduction.
- **A vulnerability** goes through [SECURITY.md](SECURITY.md); it is never a public issue.
- **A question** is asked in [GitHub discussions](https://github.com/ailuracollective/nestjs-hono-adapter/discussions).

## Out of scope

- a third-party package's own issue, reported upstream
- an application-level bug — a defect in the consuming Nest code rather than in the adapter
- an integration on a Nest major outside the matrix
- a performance claim that does not reproduce against the [benchmark suite](packages/benchmarks/README.md)

## End of life

When the 2.x line reaches end of life, its row leaves the table above and this file records it, as [SECURITY.md](SECURITY.md) requires thirty days ahead. A fix is always published against the latest minor of a supported line; nothing is backported to an older one.
