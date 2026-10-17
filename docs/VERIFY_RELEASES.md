# Verifying Release Integrity and Authenticity

Every published package carries a signed npm provenance statement generated at publish time by the npm registry from the GitHub OIDC identity. This document covers OpenSSF OSPS-DO-03.01 and DO-03.02.

## What Is Published

Packages are published to npm from a release tag by `.github/workflows/publish.yml`. Each publish runs with `npm publish --provenance`, which asks the npm registry to generate an SLSA provenance statement bound to:

- the exact Git commit the release was cut from
- the workflow file that built and published it
- the GitHub Actions run that performed the publish

## Verify the Provenance of a Package

To confirm that a published package came from this project's release pipeline:

```sh
npm view @ailura/nestjs-hono-adapter@<version> --json
```

The output includes a `dist.attestations` field when provenance is present. To verify it against npm's transparency log:

```sh
npm audit signatures
```

Run it in a directory where `@ailura/nestjs-hono-adapter` is a dependency. A verified signature reports the package as `ok`; a missing or invalid one reports the failure reason.

## Verify the Signer Identity

The provenance statement names the expected identity. For this project it is:

| Field       | Expected value                                                            |
| ----------- | ------------------------------------------------------------------------- |
| Workflow    | `.github/workflows/publish.yml` in `ailuracollective/nestjs-hono-adapter` |
| Trigger     | `release` event of type `published`                                       |
| Environment | GitHub Actions, `ubuntu-latest`                                           |

If a package claims provenance from a different workflow, a different repository, or a different trigger, it did not come from this project's pipeline and should be treated as compromised.

## Verify the Commit

The provenance statement records the commit the package was built from. To confirm it is in this repository:

```sh
git log --oneline <commit-sha>
```

A commit that does not exist in `github.com/ailuracollective/nestjs-hono-adapter` did not produce the release.

## When to Run These Checks

Run them before adopting a version in a production deployment, when installing a version that was not resolved by your lockfile, and when auditing an existing dependency for supply chain integrity.
