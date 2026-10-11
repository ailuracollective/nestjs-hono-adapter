# Examples

| Folder                    | Transport | Worker entry    |
| ------------------------- | --------- | --------------- |
| `examples/cloudflare/fetch` | fetch    | `src/worker.ts` |
| `examples/cloudflare/node`  | node     | `src/worker.ts` |

Both serve the same routes:

| Route        | Answer                                    |
| ------------ | ----------------------------------------- |
| `GET /health`  | `{ ok: true, where: 'workers' }`        |
| `GET /hello?name=` | `Hello <name>!`                     |
| `POST /echo`   | the body, echoed back                    |
| `GET /stream`  | three SSE frames, 100 ms apart         |
| `GET /docs-json` | the OpenAPI document                   |
| `GET /reference` | the Scalar API reference              |

The node one adds `GET /debug-env`, which reports the
`cloudflare:node` request binding.

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

The thirteen optional peers Nest and `@nestjs/swagger` name inside lazy
`import()`s are aliased to `src/stub-optional-peers.ts`, an empty
module. See the comment there for what they are.

Both folders are Bun workspace members, so an install from anywhere
hoists `node_modules` to the root — where the `src/` imports resolve
against.

## Why there is no Bun folder

`workerd` has no `Bun` global, and `bunServer()` reads one at import.
