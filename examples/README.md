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

Every folder here imports the adapter exactly as that snippet
does, by name and through its published subpath. Nothing aliases it:
`node_modules` holds the workspace root, and the `exports` map
answers with `dist/`, which is what a project installing from npm
gets. Run `bun run build` at the repository root once before
`wrangler dev`, and the example resolves the adapter the way its
reader will.

What `wrangler.jsonc` does alias is the part a project does copy:
the optional peers Nest and `@nestjs/swagger` name inside lazy
`import()`s, mapped to `src/stub-optional-peers.ts` so the bundler
resolves them on the way to branches this Worker never takes.
