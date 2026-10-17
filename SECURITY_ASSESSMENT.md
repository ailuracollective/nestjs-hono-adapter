# Security Assessment

## Scope

This assessment covers the `@ailura/nestjs-hono-adapter` package and its published bridges (`multipart`, `graphql`, `serve-static`, `ws`, `socket-io`).

## Threat Model

### Actors

- **Deployment operator** — runs the adapter in production; controls configuration (CORS, guards, transports, bridges)
- **End user** — sends HTTP requests to the served application; untrusted input source
- **Contributor** — proposes code changes; subject to review and CI gates
- **Attacker** — attempts to exploit vulnerabilities in request handling, response encoding, or bridge shims

### Trust Boundaries

1. **Wire → adapter** — the adapter decodes a Web `Request` into Nest's expected shape. Malformed headers, bodies, and paths are the attacker's surface.
2. **adapter → Nest** — the adapter calls Nest's lifecycle and route handler. Nest owns guards, interceptors, pipes, and filters.
3. **Nest → adapter** — Nest produces a response; the adapter encodes it back to a Web `Response`. The encoding must preserve Nest's semantics (status, headers, body, streaming).
4. **Bridge → platform** — compatibility bridges shim Express/Fastify-shaped calls onto Hono. A bridge that mis-shims could leak or corrupt data.

## Identified Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Request smuggling via malformed `Content-Length` / `Transfer-Encoding` | Low | High | Hono's `Request` parsing handles this; adapter passes the parsed object through, never raw bytes |
| Response splitting via header injection | Low | High | Adapter writes headers via Hono's typed API (`res.headers.set()`), not string interpolation |
| Bridge shim mis-mapping Express `res.send()` to Hono | Medium | Medium | `compat/express/surface.ts` has dedicated tests in `packages/core/test/` |
| Multipart parser DoS (large uploads) | Medium | Medium | `busboy` has size limits configurable via the interceptor; documented in `packages/multipart/README.md` |
| Dependency vulnerability in peer packages | Medium | High | Compatibility matrix tests against Nest 11 and 12; lockfile pins exact versions |
| Secret leakage via CI logs | Low | High | Workflows use `permissions: contents: read`, `persist-credentials: false`, and never echo secrets |

## Dependencies

Runtime dependencies are minimal and pinned via `bun.lock`:

- `hono` — HTTP framework; well-maintained, active security response
- `@nestjs/common`, `@nestjs/core` — NestJS framework; security advisories published
- `@hono/node-server` — Node transport; maintained by Hono team
- `rxjs` — reactive extensions; widely audited

Peer dependencies (installed by the consumer) are tested in the compatibility matrix but not controlled by this project.

## Update Cadence

- Dependencies are updated when compatibility matrix tests pass on both Nest 11 and 12
- Security advisories for direct dependencies trigger an immediate assessment
- `bun.lock` is frozen in CI (`lockfile.yml`); any lockfile change fails CI
