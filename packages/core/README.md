# @ailura/nestjs-hono-adapter

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter) [![bundle size](https://img.shields.io/badge/bundle%20size-≤12kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/core/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-hono-adapter)](https://socket.dev/npm/package/@ailura/nestjs-hono-adapter) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![GitHub license](https://img.shields.io/github/license/ailuracollective/nestjs-hono-adapter.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

An HTTP adapter that runs a NestJS application on [Hono](https://hono.dev), with no Express or Fastify underneath. The core is runtime-neutral; a **transport** decides how it is served: `bunServer()` (Bun's own server, the default), `nodeServer()` for `@hono/node-server`, or `fetchServer()` for a host that serves a Web `Request`/`Response`.

**Problem**: Nest has no official Hono adapter. The two published alternatives target Nest 11 and answer incorrectly — one returns a success status to a handler that threw, the other writes every response twice.

**Solution**: This package implements the Nest 11/12 `AbstractHttpAdapter` contract directly on Hono: routes are registered on a Hono application, and Hono's Web `Request`/`Response` are translated to and from the objects Nest reads and writes.

## Install

```sh
bun add @ailura/nestjs-hono-adapter hono
```

`@nestjs/common`, `@nestjs/core`, `hono` and `@hono/node-server` are peers, so the application decides their versions. `@hono/node-server` is optional: only the `./node-server` transport reaches it, and a Bun or fetch deployment never loads it. Use `npm install` or `pnpm add` in place of `bun add` as needed.

The two optional capabilities live in their own packages, each with a single entrypoint, so importing one loads none of the others:

| Package                                  | For       | Installs                          |
| ---------------------------------------- | --------- | --------------------------------- |
| `@ailura/nestjs-platform-hono-multipart` | uploads   | `busboy`                          |
| `@ailura/nestjs-platform-hono-socket-io` | socket.io | `socket.io`, `@nestjs/websockets` |

WebSockets are not a capability but a **compatibility bridge**: `@ailura/nestjs-platform-hono-ws` fits Nest's own `@nestjs/platform-ws` `WsAdapter` to Hono, so you install the package and write no import of it — `app.useWebSocketAdapter(new WsAdapter(app))` is the whole wiring. See [docs/compatibility.md](../../docs/compatibility.md).

A socket.io gateway needs the Node transport, which `./node-server` provides on Node and on Bun.

### Migrating from the old subpaths

Two things break a deployment that tracked `@ailura/nestjs-hono-adapter@1.4.1`: `./ws` moved, and the default transport is no longer the Node one.

`./ws` moves to its own package; the new package is the whole import path, so drop the trailing subpath:

| Old import                       | Install and import                |
| -------------------------------- | --------------------------------- |
| `@ailura/nestjs-hono-adapter/ws` | `@ailura/nestjs-platform-hono-ws` |

The zero-configuration bootstrap now serves through `bunServer()` where it served through `@hono/node-server`; a deployment on Node names the transport explicitly ([Use](#use)).

`ServerAdapterOptions.overrideGlobalObjects` left with the implicit Node default. `nodeServer()` keeps it and defaults it to `true`, the fastest path and the behavior the implicit Node transport had; the replacement of the global `Request` and `Response` is process-wide and not restored, so a deployment that wants the globals left alone asks by name: `nodeServer({ overrideGlobalObjects: false })`.

The Bun transport resolves `hono/bun` in a top-level await so the root entrypoint still imports on Node, which makes the package ESM only: `require()` throws, `import` works on Node and Bun.

`./multipart` and `./socket-io` were added on `main` after 1.4.1 and never published, so nobody has to migrate for them; a deployment that tracked `main` and imported one installs the matching package above.

## Use

```ts
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { bunServer } from '@ailura/nestjs-hono-adapter/bun-server';

import { AppModule } from './app.module.ts';

const app = await NestFactory.create(
  AppModule,
  new ServerAdapter({
    bodyLimit: 2 * 1024 * 1024,
    transport: bunServer(),
    trustProxy: true,
  }),
);
app.enableCors({
  credentials: true,
  origin: ['https://app.example.com'],
});
await app.listen(3000);
```

`new ServerAdapter()` with no `transport` serves through Bun's own server. A deployment on Node names it:

```ts
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';

new ServerAdapter({ transport: nodeServer() });
```

`nodeServer()` takes `autoCleanupIncoming` (default `true`), which drains a request whose body was never read, and `overrideGlobalObjects` (default `true`), which asks `@hono/node-server` to replace the process's `Request` and `Response` with its lighter classes — the fastest path, and process-wide; pass `false` to leave the globals alone. Both only reach `@hono/node-server`, so they change nothing for a deployment that serves through `bunServer()`.

On a fetch host — Cloudflare Workers, Vercel Functions or Deno — the transport takes no port and the deployment exports the handler:

```ts
import { fetchHandler, fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

const adapter = new ServerAdapter({ transport: fetchServer() });
const app = await NestFactory.create(AppModule, adapter);
await app.init();

export default { fetch: fetchHandler(adapter.getHono()) };
```

`listen()` on the fetch server is refused, passing an error to the callback or throwing when none is given. The fetch handler has no client address by default and ignores `cf-connecting-ip`; pass `fetchHandler(app, { clientAddress })` with a resolver for a trusted, host-supplied address, and read a header there only if the host guarantees clients cannot forge it. `x-forwarded-for` still supplies `ip` when `trustProxy` trusts the proxy. See [fetch hosts](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/deployment.md#fetch-hosts).

`getType()` answers `hono`, the value ecosystem packages branch on.

For in-process tests, call `await app.init()` before `app.inject()`. String targets accept relative paths and absolute URLs; `query` appends to the existing query. GET and HEAD ignore `payload`/`body`; other methods send them as the request body.

`setOnRequestHook()` continues the request when the hook calls `done` or its returned promise/thenable resolves, whichever happens first. `setOnResponseHook()` runs when the chain settles, including when the request hook throws or rejects; it waits up to one second for response-hook work before releasing the response, and later rejections are still logged. See [instrumentation hooks](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/platform-differences.md#instrumentation-hooks).

## Options

`app.set('views', directory)` accepts a string or a string array, searched in order; `app.set('view engine', extension)` accepts a string. View data combines `setViewEngine({ defaultContext })`, `setLocal()` values, and handler data, in that order, preserving locals including keys such as `__proto__`.

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `bodyLimit` | `number` | `1 MiB` | Largest non-multipart request body, in bytes; `0` removes the limit. Multipart parsing uses upload-route `limits` when the multipart package is enabled; declared lengths are still checked. |
| `rawBody` | `boolean` | `false` | Keep the bytes that were read in `NestRequest.rawBody` |
| `secureHeaders` | `boolean \| object` | `false` | Install `hono/secure-headers`, with its defaults or with the given options; off by default |
| `transport` | `Transport` | — | The runtime: `bunServer()`, `nodeServer()` or `fetchServer()` |
| `trustProxy` | `boolean \| number \| string[]` | `false` | Read `x-forwarded-proto`, `x-forwarded-for` and `x-forwarded-host` |
| `views` | `object` | — | The engine a `@Render()` handler renders with, and where templates are read from |

`app.useBodyParser()` accepts `json`, `urlencoded`, `text` and `raw`; unsupported names are rejected. Parsing follows the request's content type, and `limit` applies to every parser and route; omitting `limit` still enables parsing and applies the raw-body setting, leaving the existing size limit intact.

## Documentation

Architecture, deployment, parity and the API reference live in the repository's [`docs/`](https://github.com/ailuracollective/nestjs-hono-adapter/tree/main/docs) directory.

## Requirements

- Bun 1.2+ (toolchain, and the runtime the default transport serves on), or Node 22.12+.
- `@hono/node-server`, which `nodeServer()` serves through; it is an optional peer, and the default transport is Bun's own server.
- Nest 11 or 12.
- Hono 4.

## License

MIT
