# @ailura/nestjs-hono-adapter

<!-- Badges: calidad, seguridad y confianza -->

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter)
[![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter)
[![bundle size](https://img.shields.io/badge/bundle%20size-≤12kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/core/.size-limit.json)
[![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-hono-adapter)](https://socket.dev/npm/package/@ailura/nestjs-hono-adapter)
[![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json)
[![GitHub license](https://img.shields.io/github/license/ailuracollective/nestjs-hono-adapter.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

An HTTP adapter that runs a NestJS application on
[Hono](https://hono.dev), with no Express or Fastify underneath.
The core is runtime-neutral; a **transport** decides how it is
served. The default is `bunServer()`, Bun's own server; a
deployment on Node names `nodeServer()` for `@hono/node-server`,
and a host that serves a Web `Request`/`Response` names
`fetchServer()`.

**Problem**: Nest has no official Hono adapter. The two
published alternatives target Nest 11 and answer incorrectly —
one returns a success status to a handler that threw, the other
writes every response twice.

**Solution**: This package implements the Nest 11/12
`AbstractHttpAdapter` contract directly on Hono. Routes are
registered on a Hono application, and Hono's Web `Request` and
`Response` are translated to and from the objects Nest reads and
writes.

**Get started**: [Install](#install) ·
[Report a bug](https://github.com/ailuracollective/nestjs-hono-adapter/issues)
·
[Contribute](https://github.com/ailuracollective/nestjs-hono-adapter/pulls)

## Install

```sh
bun add @ailura/nestjs-hono-adapter hono
```

```sh
npm install @ailura/nestjs-hono-adapter hono
```

```sh
pnpm add @ailura/nestjs-hono-adapter hono
```

`@nestjs/common`, `@nestjs/core`, `hono` and `@hono/node-server`
are peer dependencies, so the application decides their
versions. `@hono/node-server` is what `nodeServer()` serves
through; the default transport is Bun's own server.

The three optional capabilities live in their own packages:
`@ailura/nestjs-platform-hono-multipart` for uploads (installs
`busboy`), `@ailura/nestjs-platform-hono-ws` for WebSockets
(installs `@hono/node-ws` and `@nestjs/websockets`) and
`@ailura/nestjs-platform-hono-socket-io` for a socket.io gateway
(installs `socket.io` and `@nestjs/websockets`; it needs the
Node transport, which `./node-server` provides on Node and on
Bun). Each has a single entrypoint, so importing one loads none
of the others.

### Migrating from the old subpaths

Two things break a deployment that tracked
`@ailura/nestjs-hono-adapter@1.4.1`: `./ws` moved, and the
default transport is no longer the Node one.

`./ws` moves to its own package:

| Old import                       | Install and import                |
| -------------------------------- | --------------------------------- |
| `@ailura/nestjs-hono-adapter/ws` | `@ailura/nestjs-platform-hono-ws` |

The new package is the whole import path: drop the trailing
subpath.

The zero-configuration bootstrap serves through `bunServer()`,
Bun's own server, where it served through `@hono/node-server`
before. A deployment on Node names the transport it always
served through, which is one import:

```ts
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';

new ServerAdapter({ transport: nodeServer() });
```

`ServerAdapterOptions.overrideGlobalObjects` left with that
default: it existed only to configure the implicit Node one. The
Node transport keeps its own and defaults it to `false`, where
the implicit default passed `true`, so a deployment that relied
on `@hono/node-server` replacing the global `Request` and
`Response` now asks for it by name:
`nodeServer({ overrideGlobalObjects: true })`.

One more consequence: the Bun transport resolves `hono/bun` in a
top-level await so the root entrypoint still imports on Node,
and that makes the package ESM only. A `require()` of it throws;
an `import` works, on Node and on Bun, and `ServerAdapter` and
`nodeServer()` work there.

`./multipart` and `./socket-io` were added on `main` after 1.4.1
and were never published, so nobody has to migrate for them. A
deployment that tracked `main` and imported one installs the
matching package: `@ailura/nestjs-platform-hono-multipart` for
uploads and `@ailura/nestjs-platform-hono-socket-io` for a
socket.io gateway.

A Socket.IO gateway with port zero attaches to the application's
Node server and requires that server to be available. An
explicit nonzero gateway port creates a separate listener; the
adapter closes that listener during shutdown.

## Use

Pick the transport for the runtime, then inject it:

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

Leaving `transport` out serves through Bun's own server:

```ts
new ServerAdapter();
```

A deployment on Node names the transport it served through
before:

```ts
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';

new ServerAdapter({ transport: nodeServer() });
```

`nodeServer()` takes `overrideGlobalObjects` (default `false`),
which asks `@hono/node-server` to replace the process's
`Request` and `Response` with its lighter classes:
`nodeServer({ overrideGlobalObjects: true })`.

On a host that serves a Web `Request`, such as Cloudflare
Workers, Vercel Functions or Deno, the fetch transport takes no
port and the deployment exports the handler:

```ts
import {
  fetchHandler,
  fetchServer,
} from '@ailura/nestjs-hono-adapter/fetch';

const adapter = new ServerAdapter({ transport: fetchServer() });
const app = await NestFactory.create(AppModule, adapter);
await app.init();

export default { fetch: fetchHandler(adapter.getHono()) };
```

The fetch server refuses `listen()` with an error passed to the
callback, or thrown directly when no callback is provided.

The fetch handler has no client address by default and ignores
`cf-connecting-ip`. Pass `fetchHandler(app, { clientAddress })`
with a resolver for a trusted address supplied by the host; read
a header there only if the host guarantees clients cannot forge
it. `x-forwarded-for` can still supply `ip` when `trustProxy`
trusts the proxy. See
[fetch hosts](docs/deployment.md#fetch-hosts) for the header
opt-in and fallback behavior.

`getType()` answers `hono`, which is the value ecosystem
packages branch on.

For in-process tests, call `await app.init()` before
`app.inject()`. String targets accept relative paths and
absolute URLs; the `query` option appends to the existing query.
GET and HEAD ignore `payload` and `body`; other methods send
them as the request body.

`setOnRequestHook()` continues the request when the hook calls
`done` or its returned promise or thenable resolves, whichever
happens first. `setOnResponseHook()` runs when the chain
settles, including when the request hook throws or rejects. It
waits up to one second for response-hook work before releasing
the response; later rejections are still logged. See
[instrumentation hooks](docs/platform-differences.md#instrumentation-hooks).

## Options

`app.set('views', directory)` accepts a string or a string
array, searched in order; `app.set('view engine', extension)`
accepts a string. View data combines
`setViewEngine({ defaultContext })`, `setLocal()` values, and
handler data in that order. Configuring defaults preserves
locals, including keys such as `__proto__`.

| Option          | Type                            | Default | Effect                                                                                                                                                                                       |
| --------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodyLimit`     | `number`                        | `1 MiB` | Largest non-multipart request body, in bytes; `0` removes the limit. Multipart parsing uses upload-route `limits` when the multipart package is enabled; declared lengths are still checked. |
| `rawBody`       | `boolean`                       | `false` | Keep the bytes that were read in `NestRequest.rawBody`                                                                                                                                       |
| `secureHeaders` | `boolean \| object`             | `true`  | Install `hono/secure-headers`, with its defaults or with the given options                                                                                                                   |
| `transport`     | `Transport`                     | —       | The runtime: `bunServer()`, `nodeServer()` or `fetchServer()`                                                                                                                                |
| `trustProxy`    | `boolean \| number \| string[]` | `false` | Read `x-forwarded-proto`, `x-forwarded-for` and `x-forwarded-host`                                                                                                                           |
| `views`         | `object`                        | —       | The engine a `@Render()` handler renders with, and where templates are read from                                                                                                             |

`app.useBodyParser()` accepts `json`, `urlencoded`, `text` and
`raw`; unsupported parser names are rejected. Parsing follows
the request's content type, and `limit` applies to every parser
and route. Omitting `limit` still enables parsing and applies
the raw-body setting, leaving the existing size limit intact.

## Documentation

| Topic                                                        | What it covers                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [docs/platform-differences.md](docs/platform-differences.md) | Where Express and Fastify disagree, and how this adapter answers; routes, query strings, bodies, responses |
| [docs/parity.md](docs/parity.md)                             | What of Nest's four platform packages is implemented here, and what is still missing                       |
| [docs/features.md](docs/features.md)                         | Server-sent events, views, static assets, CORS, request-level security                                     |
| [docs/deployment.md](docs/deployment.md)                     | TLS, proxies, shutdown, the Hono API, WebSockets, microservices                                            |
| [docs/development.md](docs/development.md)                   | Requirements, build and test commands, release process                                                     |
| [docs/api.md](docs/api.md)                                   | API reference: classes, options, and types                                                                 |
| [docs/architecture.md](docs/architecture.md)                 | The layer map, import rules, bundle ceilings, and Node boundary                                            |
| [docs/bundle-baseline.md](docs/bundle-baseline.md)           | Verified bundle and package measurements, and what the evidence supports                                   |
| [examples/](examples/)                                       | Cloudflare Workers examples — one application per transport that runs on a Worker                          |

## Requirements

- Bun 1.2+ (toolchain, and the runtime the default transport
  serves on), or Node 22.12+.
- `@hono/node-server`, which `nodeServer()` serves through; the
  default transport is Bun's own server.
- Nest 11 or 12.
- Hono 4.

## Development

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` is exactly what CI runs: lint, format,
typecheck, test, build and the bundle size gate.

## Contributing

Contributions are welcome via
[pull requests](https://github.com/ailuracollective/nestjs-hono-adapter/pulls).

### Contribution requirements

- Follow the
  [Conventional Commits](https://www.conventionalcommits.org/)
  specification (enforced by the contribution policy).
- Code must pass the project's
  [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and
  [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)
  configuration — the enforced coding standard.
- Run `bun run check` before opening a PR — it must pass lint,
  format, typecheck, test, build, and the bundle size gate.
- Read [docs/architecture.md](docs/architecture.md) before
  editing the adapter: it documents the layer map, import rules,
  and bundle ceilings.
- Tests must cover new behaviour; the suite runs against both
  Nest 11 and 12 on Bun.

## Reporting issues

Open an
[issue](https://github.com/ailuracollective/nestjs-hono-adapter/issues)
for bugs or feature requests. Include the Nest and Hono
versions, a minimal reproduction, and the behaviour you expected
versus what happened.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting
process.

## License

MIT
