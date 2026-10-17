# Security assessment

## Scope

This assessment covers the `@ailura/nestjs-hono-adapter` package and its published bridges (`multipart`, `graphql`, `serve-static`, `ws`, `socket-io`).

## Threat model

### Actors

- **Deployment operator** — runs the adapter in production; controls configuration (CORS, guards, transports, bridges)
- **End user** — sends HTTP requests to the served application; untrusted input source
- **Contributor** — proposes code changes; subject to review and CI gates
- **Attacker** — attempts to exploit vulnerabilities in request handling, response encoding, or bridge shims

### Trust boundaries

1. **Wire → adapter** — the adapter decodes a Web `Request` into Nest's expected shape. Malformed headers, bodies, and paths are the attacker's surface.
2. **adapter → Nest** — the adapter calls Nest's lifecycle and route handler. Nest owns guards, interceptors, pipes, and filters.
3. **Nest → adapter** — Nest produces a response; the adapter encodes it back to a Web `Response`. The encoding must preserve Nest's semantics (status, headers, body, streaming).
4. **Bridge → platform** — compatibility bridges shim Express/Fastify-shaped calls onto Hono. A bridge that mis-shims could leak or corrupt data.

## Attack surface analysis

The adapter's attack surface is every point where untrusted input reaches code that was written assuming it was trusted. Enumerated from the outside in:

### Untrusted entry points

| Surface | Reaches | Attacker controls |
| --- | --- | --- |
| HTTP method, path, query | route matching in `core/route/` | Fully |
| Headers (all, including `Cookie`, `Authorization`, `X-Forwarded-*`) | `core/request/` decode, CORS feature, guards | Fully |
| Body (raw bytes, JSON, URL-encoded, multipart) | request decode, `multipart/` interceptor, `busboy` | Fully |
| WebSocket frames | `ws/` and `socket-io/` bridges | After the upgrade handshake |
| Uploaded file names and content types | `multipart/` interceptor → Nest's `@UploadedFile()` | Fully |
| Server-sent event streams | `features/sse` | After subscribe |

### Critical code paths

These are the paths where a mistake crosses a trust boundary rather than merely producing a wrong answer:

1. **`core/request/` decode** — the wire-to-Nest translation. A field that is copied from the `Request` without normalization (a header read as a number, a body parsed as JSON when the content type does not say so) hands the attacker a typed value the application will trust. This path is where a Nest application would otherwise have relied on Express's normalization.

2. **`core/response/` encode** — the Nest-to-wire translation. Status, headers, and body must preserve what Nest decided; a dropped header is a broken cache policy, a coerced body is a content-type confusion.

3. **`compat/express/surface.ts`** — fits `res.send()`, `res.status()`, and the `(err, req, res, next)` middleware shape onto a `@Res()` object. A shim that calls the underlying Hono response twice, or that swallows the return value Nest inspects, corrupts the response in a way the application's own tests would not catch, because the application's tests were written against Express.

4. **`multipart/multipart.interceptor.factory.ts`** — the only code that consumes a `multipart/form-data` body and the only code that touches `busboy`. File names are attacker-controlled strings that end up in whatever the application does with them; limits are the only defense against a resource-exhaustion upload.

5. **`compat/registry/discover.ts`** — resolves bridge packages out of the application's own tree at boot. The resolution walks `node_modules` by name, so a planted package named like a bridge would be loaded. This is the one place where the adapter executes something it found rather than something it imported.

6. **`servers/node.ts`** — the Node transport. It is the only transport that has a real socket beneath it, so it is the only one where a keep-alive or header-timeout misconfiguration is reachable by an attacker holding a connection.

### Cross-boundary flows worth re-checking on change

- A new field added to `Request` decode enters every application that uses `@Req()` — the blast radius is the consumer's whole codebase, not this repository's.
- A new capability in `features/` widens the surface for every deployment that enables it; each is opt-in, which is what keeps the default surface small.
- A new bridge in `BRIDGE_PACKAGES` adds a `node_modules` name the adapter will resolve at boot without an import.

### What is deliberately not reachable

- The adapter never reads the filesystem on the request path. Static assets and views are capabilities a deployment turns on, and they go through Hono's own loaders.
- The adapter never executes a template or evaluates a string from the request. Views are rendered by the application's own engine.
- The adapter never issues an outbound request. A proxy or an egress call is application code, outside this trust boundary.

## Identified risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
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

## Update cadence

- A dependency is updated when the compatibility matrix passes on both Nest 11 and 12.
- A security advisory for a direct dependency is assessed at once.
- `bun.lock` stays at `lockfileVersion: 1`: the `lockfile` job in `.github/workflows/lockfile.yml` fails any other version, because that is the format the Cloudflare build image reads. The file itself is reviewed like any other change.
