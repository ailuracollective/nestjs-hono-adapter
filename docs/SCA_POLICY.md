# SCA Policy

Software Composition Analysis findings — vulnerabilities and license violations in dependencies — are governed by the thresholds below. This policy covers OpenSSF OSPS-VM-05.01, VM-05.02, and VM-05.03.

## Remediation Thresholds

| Severity | Threshold   | Target                |
| -------- | ----------- | --------------------- |
| Critical | Block merge | Fix within 24 hours   |
| High     | Block merge | Fix within 7 days     |
| Medium   | Warn        | Fix within 30 days    |
| Low      | Track       | Next scheduled update |
| Info     | Track       | No action required    |

Any finding with an available fix in a direct dependency blocks the merge until resolved or explicitly suppressed.

## License Violations

| License Type | Action |
| --- | --- |
| Copyleft (GPL, AGPL) in a published package | Block merge |
| Unknown / unapproved | Block merge |
| Permissive (MIT, BSD, Apache-2.0, ISC) | Allow |
| Dual-licensed with copyleft | Allow if the consumer may choose the permissive option |

Approved licenses: MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, Unlicense.

## Enforcement

- **On every pull request**: Snyk Code (`security/snyk`) and `actions/dependency-review-action` (`.github/workflows/security.yml`) scan for vulnerabilities and license violations
- **Before release**: the publish pipeline verifies no high or critical findings are unresolved in direct dependencies
- **Blocking findings** must be fixed or suppressed with a justification recorded in `VEX.md`

## Suppression

A finding may be suppressed only when:

1. The vulnerable code path is not reachable from the adapter's public interfaces (see `SECURITY_ASSESSMENT.md` for the trust boundaries)
2. The justification is recorded in `VEX.md` with the CVE, dependency, and reasoning
3. The suppression is reviewed on each dependency update
