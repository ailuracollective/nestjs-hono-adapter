# Verifying a release

Every published package carries an npm provenance statement, minted at publish time by the npm registry from the GitHub OIDC identity. This document covers OpenSSF OSPS-DO-03.01 and DO-03.02.

## What is published

`.github/workflows/publish.yml` publishes from a release tag, and each run executes `npm publish --provenance`, so the registry generates an SLSA provenance statement bound to:

- the commit the release was cut from
- the workflow file that built and published it
- the GitHub Actions run that performed the publish

## Verifying a package's provenance

The provenance statement of a published version is read from the registry:

```sh
npm view @ailura/nestjs-hono-adapter@<version> --json
```

Provenance is present when the output carries a `dist.attestations` field. The signature itself is checked against npm's transparency log with:

```sh
npm audit signatures
```

The check runs in a directory where the package is a dependency. A verified signature reports the package as `ok`; a missing or invalid one reports the reason.

## Verifying the signer

The statement names the identity that produced the release, and for this project it is:

| Field       | Expected value                                                            |
| ----------- | ------------------------------------------------------------------------- |
| Workflow    | `.github/workflows/publish.yml` in `ailuracollective/nestjs-hono-adapter` |
| Trigger     | the `release` event of type `published`                                   |
| Environment | GitHub Actions, `ubuntu-26.04`                                            |

A package claiming provenance from another workflow, another repository or another trigger did not come from this pipeline and is treated as compromised.

## Verifying the commit

The statement records the commit the package was built from, and its presence in this repository is checked with:

```sh
git log --oneline <commit-sha>
```

A commit absent from `github.com/ailuracollective/nestjs-hono-adapter` produced no release here.

## When these checks run

- before a version is adopted in production
- whenever a version is installed outside the lockfile
- in an audit of an existing dependency for supply chain integrity
