# Examples

One Nest application behind a transport, grouped by platform.

| Runtime            | Fetch | Node | Bun |
| ------------------ | ----- | ---- | --- |
| Cloudflare Workers | ✔️   | ✔️   | ❌  |

Every folder runs the same application: a health route, a query
route, a JSON echo, and a Server-Sent Events stream. Every folder
also documents itself: `/docs-json` is the OpenAPI document and
`/reference` the Scalar API reference.

The Bun column is ❌ because Workers runs `workerd`, which has no
`Bun` global — not because the transport is incomplete.
`examples/cloudflare/bun/` is the pairing, kept so the failure is
inspectable: it builds and uploads cleanly, then refuses to start.
Bun itself is the package's default-compatible runtime; it just
cannot be one *inside* a Worker.

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

A folder under `examples/` does **not** write that import. It
reaches the same code through this repository's own layout:

```ts
import { fetchServer } from '@ailura/nestjs-hono-adapter/servers/fetch';
```

Those subpaths are not in the package's `exports` map, and no
install would ever answer them. `wrangler.jsonc` and `tsconfig.json`
alias each one to the source under `src/servers/`, which is the whole
reason they resolve: a folder here runs from a fresh clone, with no
build step and no `dist/`, and the aliases stand in for the install
that has not happened.

So read the two spellings for what they are. The snippet above is
what you write. The one in `src/worker.ts` is what this repository
writes, and it is not something to copy — it names a path that exists
only here.

The rest of `alias` is the part a project does copy: the optional
peers Nest and `@nestjs/swagger` name inside lazy `import()`s, mapped
to `src/stub-optional-peers.ts` so the bundler resolves them on the
way to branches these Workers never take.
