# Assurance Case

This document provides an assurance case for the security of the
`@ailura/nestjs-hono-adapter` project.

## Threat Model

### Assets

- The NestJS application and its data
- The server infrastructure running the adapter
- The package reputation and user trust

### Threats

| Threat                     | Description                                                | Likelihood | Impact |
| -------------------------- | ---------------------------------------------------------- | ---------- | ------ |
| Injection attacks          | Malicious input designed to execute arbitrary code         | Medium     | High   |
| Denial of Service          | Attacks that overwhelm the server with requests            | Medium     | Medium |
| Dependency vulnerabilities | Vulnerabilities in third-party packages                    | Low        | High   |
| Misconfiguration           | Incorrect adapter configuration leading to security issues | Medium     | Medium |
| Prototype pollution        | Attacks targeting JavaScript prototype chain               | Low        | High   |

### Attack Surface

The primary attack surface is the HTTP interface:

- Request headers
- Query parameters
- Path parameters
- Request body
- Cookies (passed through to the application)

## Secure Design Principles

### Least Privilege

The adapter:

- Does not implement authentication or authorization
- Does not store or manage credentials
- Does not execute arbitrary code from input
- Only translates between NestJS and Hono interfaces

### Defense in Depth

Security is provided at multiple layers:

1. **Input validation**: Body size limits, content-type
   validation, prototype pollution protection
2. **Secure headers**: Default security headers via
   `hono/secure-headers`
3. **Framework security**: Relies on Hono and NestJS security
   features
4. **Dependency management**: Locked dependencies, vulnerability
   scanning in CI

### Fail Secure

The adapter fails securely:

- Invalid input is rejected with appropriate HTTP error codes
- Body size violations result in `413 Payload Too Large`
- Unhandled errors are caught by NestJS exception layer
- No sensitive information is leaked in error responses

## Common Weaknesses Addressed

| Weakness                              | Mitigation                                                 |
| ------------------------------------- | ---------------------------------------------------------- |
| Injection (OWASP A01)                 | Input validation, parameterized handling                   |
| Broken authentication (OWASP A02)     | Not implemented at adapter level; delegated to application |
| Prototype pollution (OWASP A03)       | Dangerous keys stripped from query strings                 |
| Insecure design (OWASP A04)           | Minimal attack surface, least privilege                    |
| Security misconfiguration (OWASP A05) | Secure defaults, documented options                        |
| Vulnerable components (OWASP A06)     | Locked dependencies, CI vulnerability scanning             |
| Input validation (OWASP A07)          | Body size limits, content-type validation                  |
| Data integrity (OWASP A08)            | No client-side state storage                               |
| Logging and monitoring (OWASP A09)    | Application-level logging via NestJS                       |

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      UNTRUSTED                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTTP Request (headers, body, query, path)          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      TRUSTED                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ServerAdapter (input validation, translation)      │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  NestJS Application (guards, interceptors)          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Hono Framework (routing, middleware)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Evidence

| Evidence                        | Location                   |
| ------------------------------- | -------------------------- |
| Input validation implementation | `src/core/request/`        |
| Security headers configuration  | `src/features/security/`   |
| Test coverage                   | `test/` directory          |
| Vulnerability scanning          | `.github/workflows/ci.yml` |
| Dependency locking              | `bun.lock`                 |

## Residual Risks

1. **Application-level vulnerabilities**: The adapter is only as
   secure as the NestJS application using it
2. **Dependency vulnerabilities**: Despite monitoring, zero-day
   vulnerabilities in dependencies may exist
3. **Misconfiguration**: Users may disable security features
   (e.g., `secureHeaders: false`)

## Review History

| Date       | Reviewer               | Findings             |
| ---------- | ---------------------- | -------------------- |
| 2026-10-08 | Initial assurance case | No critical findings |

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
