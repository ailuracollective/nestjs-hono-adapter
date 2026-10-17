# VEX Statement

This document records the exploitability status of known vulnerabilities in dependencies that do not affect this project, as required by OpenSSF OSPS-VM-04.02.

## Scope

Dependencies that are declared but do not execute in this project's runtime paths, or where the vulnerable code path is not reachable from the adapter's public interfaces.

## Statements

| CVE                         | Dependency | Version | Status | Justification | Assessed |
| --------------------------- | ---------- | ------- | ------ | ------------- | -------- |
| _(none currently recorded)_ |            |         |        |               |          |

## How to Update

When a vulnerability is assessed as not affecting this project:

1. Add a row to the table above with the CVE, dependency, version, and justification
2. Assess against the adapter's actual execution paths (see `SECURITY_ASSESSMENT.md` for the trust boundaries)
3. Re-assess on each dependency update
4. Remove the row when the vulnerability is fixed in the dependency

## Contributing

If you believe a row is incorrect or a vulnerability should be recorded, open an issue or submit a pull request updating this document.
