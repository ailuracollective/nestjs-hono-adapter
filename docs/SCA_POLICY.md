# SCA policy

Software composition analysis — vulnerabilities and licence violations in dependencies — is governed by the thresholds below. This policy covers OpenSSF OSPS-VM-05.01, VM-05.02 and VM-05.03.

## Remediation thresholds

| Severity | Threshold   | Target                |
| -------- | ----------- | --------------------- |
| Critical | Block merge | Fix within 24 hours   |
| High     | Block merge | Fix within 7 days     |
| Medium   | Warn        | Fix within 30 days    |
| Low      | Track       | Next scheduled update |
| Info     | Track       | No action required    |

A finding with an available fix in a direct dependency blocks the merge until it is resolved or its suppression is recorded.

## Licence violations

| Licence | Action |
| --- | --- |
| Copyleft (GPL, AGPL) in a published package | Block merge |
| Unknown or unapproved | Block merge |
| Permissive (MIT, BSD, Apache-2.0, ISC) | Allow |
| Dual-licensed with copyleft | Allow when the consumer may choose the permissive option |

The approved list is MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD and Unlicense. The published packages ship MIT.

## How it runs

Two jobs and one platform check:

- `dependency-review`, in `.github/workflows/security.yml`, runs `actions/dependency-review-action` on every pull request with `fail-on-severity: high`, so a new high-severity dependency blocks the merge.
- `gitleaks`, in the same workflow, scans the history for committed credentials on every push and pull request.
- GitHub code scanning reports dependency findings on the pull request itself; the thresholds above are what a maintainer applies to them.

## Suppressing a finding

A finding is suppressed only when all three hold:

1. The vulnerable code path is unreachable from the adapter's public interfaces — [SECURITY_ASSESSMENT.md](../SECURITY_ASSESSMENT.md) names the trust boundaries.
2. The suppression is recorded in [VEX.md](../VEX.md) with the CVE, the dependency and the reasoning.
3. It is assessed again on every dependency update.
