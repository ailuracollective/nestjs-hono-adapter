# Hardening Mechanisms

This document describes the hardening mechanisms implemented in
the `@ailura/nestjs-hono-adapter` project.

## Build Hardening

### Compiler Warnings

- **oxlint**: Enforces strict code quality rules
- **TypeScript strict mode**: Enabled in `tsconfig.json`
- **oxfmt**: Consistent formatting prevents subtle errors

### Bundle Size Limits

- **size-limit**: Enforces maximum bundle size (see
  `.size-limit.json`)
- **Peer dependencies**: Keeps the bundle small by excluding
  NestJS and Hono

## Runtime Hardening

### Input Validation

| Mechanism                      | Implementation                                                    |
| ------------------------------ | ----------------------------------------------------------------- |
| Body size limit                | `bodyLimit` option (default 1 MiB)                                |
| Content-type validation        | Rejects invalid content types                                     |
| Prototype pollution protection | Strips `__proto__`, `constructor`, `prototype` from query strings |
| Route validation               | Only registered routes are reachable                              |

### Secure Defaults

| Feature                | Default  | Configurable                   |
| ---------------------- | -------- | ------------------------------ |
| Security headers       | Enabled  | `secureHeaders: false`         |
| Trust proxy            | Disabled | `trustProxy: true`             |
| Global object override | Enabled  | `overrideGlobalObjects: false` |
| Raw body               | Disabled | `rawBody: true`                |

## Dependency Hardening

### Locked Dependencies

- `bun.lock` pins exact dependency versions
- CI fails if `bun.lock` is out of sync with `package.json`

### Vulnerability Monitoring

- **Snyk**: Continuous monitoring of dependencies
- **CI audit**: `bun audit` runs on every CI pipeline
- **Dependabot**: Automated dependency updates (if enabled)

## Process Hardening

### Code Review

- All changes require review by a maintainer
- Reviews check for security issues (see
  [code-review.md](code-review.md))

### Automated Testing

- Unit tests for all core functionality
- Integration tests for HTTP behaviors
- Compatibility tests against NestJS 11/12 and Node 22/24

### Continuous Integration

- Every push triggers CI
- CI runs lint, format, typecheck, test, build, and size checks
- Releases are automated via semantic-release

## Deployment Hardening

### Recommended Configuration

```ts
const app = await NestFactory.create(
  AppModule,
  new ServerAdapter({
    bodyLimit: 1024 * 1024, // 1 MiB
    secureHeaders: true, // Enable security headers
    trustProxy: true, // If behind a reverse proxy
  }),
);
```

### Security Headers

When `secureHeaders: true` (default), the following headers are
set:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=15552000; includeSubDomains
```

### TLS

- Use HTTPS in production
- Configure TLS at the reverse proxy or load balancer
- The adapter supports Node.js TLS options via
  `NestFactory.create` options

## Monitoring

### Logging

The adapter does not implement logging directly. Use NestJS
logging:

```ts
import { Logger } from '@nestjs/common';

const logger = new Logger('ServerAdapter');
```

### Metrics

Deployments should monitor:

- Request rate and latency
- Error rates (4xx, 5xx)
- Memory usage
- Event loop lag

## Incident Response

See [SECURITY.md](../SECURITY.md) for the vulnerability
reporting and response process.

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
