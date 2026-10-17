# SAST Policy

Static Application Security Testing findings are governed by the thresholds below. This policy covers OpenSSF OSPS-VM-06.01 and VM-06.02.

## Remediation Thresholds

| Severity | Threshold   | Target                |
| -------- | ----------- | --------------------- |
| Critical | Block merge | Fix within 24 hours   |
| High     | Block merge | Fix within 7 days     |
| Medium   | Warn        | Fix within 30 days    |
| Low      | Track       | Next scheduled update |
| Info     | Track       | No action required    |

## What SAST Covers

The SAST tooling scans for:

- Injection vulnerabilities (SQL, command, template)
- Cross-site scripting (XSS)
- Path traversal
- Insecure deserialization
- Hardcoded credentials
- Unsafe cryptographic use
- Prototype pollution

## Enforcement

- **On every pull request**: the SAST status check runs against the full diff
- **High and critical findings block the merge** until fixed or explicitly suppressed
- **False positives** are suppressed with a comment referencing the CWE and the reason the path is unreachable

## Suppression

A finding may be suppressed only when:

1. The vulnerable code path is not reachable from the adapter's public interfaces
2. The justification references the trust boundary it crosses (see `SECURITY_ASSESSMENT.md`)
3. The suppression is reviewed on each release
