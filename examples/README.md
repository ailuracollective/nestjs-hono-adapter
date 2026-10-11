# Examples

| Folder                    | Transport | Worker entry    |
| ------------------------- | --------- | --------------- |
| `examples/cloudflare/fetch` | fetch    | `src/worker.ts` |
| `examples/cloudflare/node`  | node     | `src/worker.ts` |

Both carry `enableVersioning({ type: URI, defaultVersion: '1' })`,
so every route sits under `/v1` unless it says otherwise:

| Route              | Answer                                       |
| ------------------ | -------------------------------------------- |
| `GET /v1/health`   | `{ ok: true, where: 'workers' }`            |
| `GET /v1/hello?name=` | `Hello <name>!`                         |
| `GET /v2/hello`    | `{ from: 'v2' }`, the versioned controller   |
| `POST /v1/echo`    | the body, echoed back                        |
| `POST /v1/raw`     | the byte count Nest kept, with `rawBody: true` |
| `GET /v1/stream`   | three SSE frames, 100 ms apart              |
| `GET /v1/boom`     | 418, answered by the filter                  |
| `GET /v1/docs-json` | the OpenAPI document                        |
| `GET /v1/reference` | the Scalar API reference                    |

CORS is on for `https://example.com`, and `bodyLimit` is 1 KiB, so a
larger body is refused with a 413:

```sh
curl -i -X OPTIONS localhost:8787/v1/hello \
  -H 'Origin: https://example.com' \
  -H 'Access-Control-Request-Method: GET'
```

The node one adds `GET /v1/debug-env`, which reports the
`cloudflare:node` request binding.

The fetch one adds two, both about the host:

| Route              | Answer                                      |
| ------------------ | ------------------------------------------- |
| `GET /v1/whoami`   | the client address, from `cf-connecting-ip`  |
| `GET /v1/private`  | needs `x-api-token: let-me-in`, else 401     |

```sh
curl localhost:8787/v1/whoami
curl -H 'x-api-token: let-me-in' localhost:8787/v1/private
```

## Run it

```sh
bun install
bun run --cwd examples/cloudflare/fetch dev
```

Swap `fetch` for `node` for the other one.

## Deploy it

Root directory is the example folder. Its `package.json` carries the
scripts:

| Setting                      | Value           |
| ---------------------------- | --------------- |
| Root directory               | `examples/cloudflare/fetch` |
| Build command                | `bun install --frozen-lockfile` |
| Deploy command               | `bun run deploy` |
| Non-production branch deploy | `bun run preview` |

`preview` is `wrangler versions upload`, not `wrangler preview` —
the latter rejects this bundle.

From the repository root instead, name the config:

```sh
bunx wrangler deploy --config examples/cloudflare/fetch/wrangler.jsonc
```

## The transport import

A project imports a published subpath:

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

new ServerAdapter({ transport: fetchServer() });
```

These folders import `.../servers/fetch` instead, which is **not** in
the package's `exports` map. `wrangler.jsonc` and `tsconfig.json` each
alias it to `src/servers/fetch.ts`, which is why it resolves from a
fresh clone with no build. Do not copy that spelling.

## The client address

A fetch host has no socket, so `req.ip` is empty unless the host names
one. The fetch Worker passes a `clientAddress` resolver that reads
`cf-connecting-ip`, which Cloudflare sets and strips from clients.

`trustProxy` stays off there on purpose: with it on, `x-forwarded-for`
is read in place of the host's address.

Both folders are Bun workspace members, so an install from anywhere
hoists `node_modules` to the root — where the `src/` imports resolve
against.

The thirteen optional peers Nest and `@nestjs/swagger` name inside lazy
`import()`s are aliased to `src/stub-optional-peers.ts`, an empty
module. See the comment there for what they are.

## Constructor injection

`BoomFilter` takes a `HttpAdapterHost` and names it with `@Inject`,
rather than leaning on the constructor type. Wrangler transpiles with
esbuild, which does not emit `design:paramtypes`, so without the
decorator Nest builds the filter with nothing and `catch` throws on
the first request. Anything in these folders with a constructor
parameter needs the decorator.

## Why there is no Bun folder

`workerd` has no `Bun` global, and `bunServer()` reads one at import.
