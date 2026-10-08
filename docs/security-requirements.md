# Security Requirements

This document describes the security requirements and
expectations for the `@ailura/nestjs-hono-adapter` project.

## Trust Boundaries

The adapter operates within the following trust boundaries:

1. **Untrusted input**: HTTP requests from clients (headers,
   body, query parameters, path parameters)
2. **Trusted internal**: NestJS application code, configuration
   from the application developer
3. **External systems**: Hono framework, NestJS framework,
   Node.js runtime

## Security Requirements

### Input Validation

The adapter validates and sanitizes all untrusted input:

| Input           | Validation                                                                            |
| --------------- | ------------------------------------------------------------------------------------- |
| HTTP headers    | Standard HTTP parsing by Hono; headers are not interpreted as code                    |
| Query strings   | Parsed with `qs` grammar; `__proto__`, `constructor` and `prototype` keys are dropped |
| Path parameters | Matched against Hono route patterns; only registered routes are reachable             |
| Request body    | Size limited by `bodyLimit` option (default 1 MiB); content-type validated            |
| Content-Type    | Parsed and routed to appropriate body parser                                          |

### Output Security

The adapter applies the following security headers by default
via `hono/secure-headers`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (when serving over HTTPS)

These can be configured or disabled via the `secureHeaders`
option.

### Dependency Security

- All dependencies are managed via `bun.lock` with exact
  versions
- Peer dependencies (`@nestjs/*`, `hono`, `@hono/node-server`)
  are pinned to compatible ranges
- The CI pipeline runs `bun audit` to check for known
  vulnerabilities
- Snyk monitors dependencies continuously (see README badge)

### Cryptographic Practices

The adapter does not implement cryptography directly. It relies
on:

- Node.js `crypto` module for any cryptographic operations
- Hono's built-in cryptographic utilities where applicable
- TLS termination handled by the deployment environment or
  `@hono/node-server`

### Access Control

The adapter does not implement authentication or authorization.
These responsibilities belong to:

- The NestJS application (via guards and interceptors)
- The deployment environment (reverse proxy, API gateway)
- Hono middleware registered by the application

## Security Guarantees

The adapter guarantees:

1. **No code execution from input**: Untrusted input is never
   evaluated as code
2. **Body size limits**: Requests exceeding `bodyLimit` are
   rejected with `413 Payload Too Large`
3. **Prototype pollution protection**: Dangerous keys
   (`__proto__`, `constructor`, `prototype`) are stripped from
   query strings
4. **Response isolation**: Each request gets its own response
   object; no cross-request state leakage

## Known Limitations

1. **Denial of Service**: The adapter does not implement rate
   limiting; this should be handled by the deployment
2. **TLS**: The adapter supports TLS but does not enforce it;
   deployments must configure HTTPS
3. **CORS**: The adapter supports CORS but defaults to no CORS
   headers; applications must explicitly enable it

## Vulnerability Reporting

See [SECURITY.md](../SECURITY.md) for the vulnerability
reporting process.

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
