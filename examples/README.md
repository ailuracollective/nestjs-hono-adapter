# Examples

One Nest application behind a transport, grouped by platform.

| Runtime            | Fetch | Node | Bun |
| ------------------ | ----- | ---- | --- |
| Cloudflare Workers | ✔️   | ✔️   | ❌  |

`examples/cloudflare/fetch` and `examples/cloudflare/node` are the two
folders. Both run the same application: a health route, a query route,
a JSON echo, and a Server-Sent Events stream. Both document themselves
— `/docs-json` is the OpenAPI document, `/reference` the Scalar API
reference.

## Deploying to Cloudflare

Both folders build, but the alias decides **where** the build has to
run. The transport alias points at `src/servers/`, so the repository
has to be present, and its dependencies installed, for the bundler to
read the library's own imports out of the tree.

The two example folders are Bun workspace members of the repository
root, so an install run anywhere — the root or an example — hoists
`node_modules` to the root, the directory the library's imports under
`src/` resolve against.

A Worker Builds project therefore takes the example folder as its root
directory, which lets Wrangler find `wrangler.jsonc` without a
`--config` flag. The folder's `package.json` carries the two commands:

| Setting                      | Value                           |
| ---------------------------- | ------------------------------- |
| Root directory               | `examples/cloudflare/fetch`     |
| Build command                | `bun install --frozen-lockfile` |
| Deploy command               | `bun run deploy`                |
| Non-production branch deploy | `bun run preview`               |

and the node pairing takes `examples/cloudflare/node` as its root.

The scripts are `wrangler deploy` and `wrangler versions upload`. Use
`versions upload`, not `wrangler preview`: the latter is an open beta
command, and its preview runtime rejects this bundle with a
`createRequire` error whatever the root.

From the repository root instead, name the configuration file:

| Setting        | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Root directory | the repository root                                      |
| Build command  | `bun install --frozen-lockfile`                          |
| Deploy command | `bunx wrangler deploy --config examples/cloudflare/fetch/wrangler.jsonc` |

Were the examples not workspace members, an install landing in the
example folder would leave the library's imports with nothing to
resolve against, and the build would fail on `@nestjs/common` and
`hono`, every one of them from a file under `src/`. That is why the
workspace matters here.

## The transports

A real project installs the package and imports one subpath:

```sh
bun add @ailura/nestjs-hono-adapter hono
```

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { bunServer } from '@ailura/nestjs-hono-adapter/bun-server';
// or:
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
// or, for a fetch host (Workers, Vercel Functions, Deno):
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

new ServerAdapter({ transport: bunServer() });
```

That snippet is what you write. A folder here does not write it — it
reaches the same code under this repository's own layout:

```ts
import { fetchServer } from '@ailura/nestjs-hono-adapter/servers/fetch';
```

`/servers/*` is not in the package's `exports` map and no install would
answer it. `wrangler.jsonc` and `tsconfig.json` alias each one to the
source under `src/servers/`, which is the whole reason it resolves: a
folder runs from a fresh clone, with no build step and no `dist/`, and
the alias stands in for the install that has not happened. Do not copy
that spelling into a project.

The rest of `alias` is the part a project does copy: the optional
peers Nest and `@nestjs/swagger` name inside lazy `import()`s — the
HTTP and WebSocket platforms, the validation and serialization
packages, and the five microservice transports — mapped to
`src/stub-optional-peers.ts` so the bundler resolves them on the way to
branches these Workers never take. Installing them instead would drag
express and eight clients into a Worker that reaches for none of them.

## Why the Bun column is ❌

Bun is a published transport and it works; it just cannot be one
*inside* a Worker. A Cloudflare Worker runs on `workerd`, which has no
`Bun` global at all, and `bunServer()` reaches for one through
`hono/bun`, whose `ssg.js` opens with `const { write } = Bun;` at
module scope. That is evaluated on import, so a Worker pairing the two
fails before it reaches `Bun.serve` — earlier and louder than the
transport alone would suggest.

The failure is worth knowing precisely rather than discovering it: the
reference is a bare identifier, so a bundler resolves it to nothing and
emits a `ReferenceError: Bun is not defined` the first time the module
is evaluated. `wrangler deploy` reports success, `wrangler dev` answers
*The Workers runtime failed to start*, and every request gets nothing.
Serve through the fetch or the node transport instead.

