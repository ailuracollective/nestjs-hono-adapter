# SAST policy

Static application security testing — the analysis of source for the defects a scanner recognises without executing anything — is governed by the thresholds below. This policy covers OpenSSF OSPS-VM-06.01 and VM-06.02.

## Remediation thresholds

| Severity | Threshold   | Target                |
| -------- | ----------- | --------------------- |
| Critical | Block merge | Fix within 24 hours   |
| High     | Block merge | Fix within 7 days     |
| Medium   | Warn        | Fix within 30 days    |
| Low      | Track       | Next scheduled update |
| Info     | Track       | No action required    |

## What the analysis covers

- injection — SQL, command and template
- cross-site scripting
- path traversal
- insecure deserialization
- hardcoded credentials
- unsafe cryptographic use
- prototype pollution

## How it runs

The analysis is GitHub code scanning, configured on the platform rather than in a workflow file in this repository; its check reports on the `security/snyk` check of every pull request. It is deliberately not a step in `.github/workflows/`, because the findings arrive on the pull request itself.

A critical or high finding blocks the merge until it is fixed or its suppression is recorded.

## Suppressing a finding

A finding is suppressed only when all three hold:

1. The vulnerable code path is unreachable from the adapter's public interfaces — [SECURITY_ASSESSMENT.md](../SECURITY_ASSESSMENT.md) names the trust boundaries and the paths that cross them.
2. The suppression names the CWE and the reason the path is unreachable.
3. A dependency vulnerability is recorded in [VEX.md](../VEX.md) as well, with the CVE and the reasoning.
