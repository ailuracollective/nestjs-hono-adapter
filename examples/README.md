# Examples

One Nest application behind a transport, grouped by platform.

| Runtime            | Fetch | Node | Bun |
| ------------------ | ----- | ---- | --- |
| Cloudflare Workers | ✔️   | ✔️   | ❌  |

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
