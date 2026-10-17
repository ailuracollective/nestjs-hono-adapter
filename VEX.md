# VEX statement

This document records the exploitability status of the known vulnerabilities that do not affect this project, as OpenSSF OSPS-VM-04.02 requires.

## Scope

A dependency that is declared but never executes on a runtime path this repository reaches, and a vulnerability whose vulnerable code path is unreachable from the adapter's public interfaces.

## Statements

| CVE               | Dependency | Version | Status | Justification | Assessed |
| ----------------- | ---------- | ------- | ------ | ------------- | -------- |
| _(none recorded)_ |            |         |        |               |          |

## Recording a statement

A vulnerability is assessed against the adapter's real execution paths — [SECURITY_ASSESSMENT.md](SECURITY_ASSESSMENT.md) names the trust boundaries they cross — and recorded here only when the assessment says it does not affect the project:

1. A row is added with the CVE, the dependency, the version and the justification.
2. The justification names the trust boundary the vulnerable path does not cross.
3. The row is assessed again on every dependency update.
4. The row is removed when the dependency ships the fix.

A statement here that a reader believes wrong is an issue or a pull request against this document.
