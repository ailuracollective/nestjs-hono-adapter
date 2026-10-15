# Examples

| Folder                    | Transport | Worker entry    |
| ------------------------- | --------- | --------------- |
| `packages/examples/cloudflare/fetch` | fetch    | `src/worker.ts` |
| `packages/examples/cloudflare/node`  | node     | `src/worker.ts` |

Both carry `enableVersioning({ type: URI, defaultVersion: '1' })`,
so every route sits under `/v1` unless it says otherwise:

| Route              | Answer                                       |
| ------------------ | -------------------------------------------- |
| `GET /v1/health`   | `{ ok: true, where: 'workers' }`            |
| `GET /v1/hello?name=` | `Hello <name>!`                         |
| `GET /v1/query?foo=bar` | `{ foo: 'bar' }`, all query parameters |
| `GET /v2/hello`    | `{ from: 'v2' }`, the versioned controller   |
| `POST /v1/echo`    | the body, echoed back                        |
| `POST /v1/raw`     | the byte count Nest kept, with `rawBody: true` |
| `GET /v1/stream`   | three SSE frames, 100 ms apart              |
| `GET /v1/boom`     | 418, answered by the filter                  |
| `GET /v1/private`  | 401 without the token                         |
| `GET /v1/whoami`   | the client address                            |
| `GET /v1/docs-json` | the OpenAPI document                        |
| `GET /v1/reference` | the Scalar API reference                    |

CORS is on for `https://example.com` and `bodyLimit` is 1 KiB, so
a larger body is refused with a 413:

```sh
curl -i -X OPTIONS localhost:8787/v1/hello \
  -H 'Origin: https://example.com' \
  -H 'Access-Control-Request-Method: GET'
```

Both carry a guard on `GET /v1/private` needing
`x-api-token: let-me-in` (401 without it), and both answer
`GET /v1/whoami` with the client address: the fetch Worker reads
`cf-connecting-ip`, the node one reads the `cloudflare:node`
socket. The node one also adds `GET /v1/debug-env`, which reports
that request binding.

## Run it

```sh
bun install
bun run --cwd packages/examples/cloudflare/fetch dev
```

Swap `fetch` for `node` for the other one.

## Deploy it

Root directory is the example folder. Its `package.json` carries
the scripts:

| Setting                      | Value           |
| ---------------------------- | --------------- |
| Root directory               | `packages/examples/cloudflare/fetch` |
| Build command                | `bun install --frozen-lockfile` |
| Deploy command               | `bun run deploy` |
| Non-production branch deploy | `bun run preview` |

`preview` is `wrangler versions upload` with
`WRANGLER_CI_MATCH_TAG` unset, not `wrangler preview` — the
latter rejects this bundle. Workers Builds hands a branch build a
tag that belongs to no Worker, so wrangler's pre-upload identity
check refuses every upload with `The name in your wrangler.jsonc
file (...) must match the name of your Worker`. Dropping the
variable skips that check, the workaround in
[cloudflare/workers-sdk#15682](https://github.com/cloudflare/workers-sdk/issues/15682).
`env` is POSIX and the Workers Builds host is Linux.

From the repository root instead, name the config:

```sh
bunx wrangler deploy --config packages/examples/cloudflare/fetch/wrangler.jsonc
```

## The transport import

A project imports a published subpath:

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

new ServerAdapter({ transport: fetchServer() });
```

These folders import `.../servers/fetch` instead, which is **not**
in the package's `exports` map: `wrangler.jsonc` and
`tsconfig.json` alias it to `packages/core/src/servers/fetch.ts`,
so it resolves from a fresh clone with no build. Do not copy that
spelling.

## The client address

A fetch host has no socket, so `req.ip` is empty unless the host
names one; the fetch Worker passes a `clientAddress` resolver
reading `cf-connecting-ip`, which Cloudflare sets and strips from
clients. `trustProxy` stays off in both examples, so
`x-forwarded-for` cannot replace the host's address or the Node
socket address.

Both folders are Bun workspace members, so an install from
anywhere hoists `node_modules` to the root, where the
`packages/core/src/` imports resolve.

The thirteen optional peers Nest and `@nestjs/swagger` name inside
lazy `import()`s are aliased to `src/stub-optional-peers.ts`, an
empty module (see the comment there). The `node:module` specifier
is aliased to `src/stub-node-module.ts` in both folders:
`@nestjs/swagger` builds a `require` at module scope with
`createRequire(import.meta.url)`, and a bundled Worker leaves
`import.meta.url` undefined
([workerd#6986](https://github.com/cloudflare/workerd/issues/6986)),
so the call throws before the Worker boots. The shim defaults the
argument to a file URL. The `define` in `wrangler.jsonc` hides the
same thing for `wrangler deploy` and `wrangler versions upload`,
but `wrangler preview` ignores `define`, so the alias is what keeps
`npx wrangler preview` — the command Workers Builds resets preview
branches to — working.

## Constructor injection

`BoomFilter` takes a `HttpAdapterHost` and names it with
`@Inject`, rather than leaning on the constructor type. Wrangler
transpiles with esbuild, which does not emit `design:paramtypes`,
so without the decorator Nest builds the filter with nothing and
`catch` throws on the first request. Anything in these folders
with a constructor parameter needs the decorator.

## Why there is no Bun folder

`workerd` has no `Bun` global, so it cannot run `Bun.serve`, which
is what `bunServer()` serves through.
