# @ailura/nestjs-hono-adapter

<!-- Badges: calidad, seguridad y confianza -->

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter)
[![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter)
[![bundle size](https://img.shields.io/badge/bundle%20size-≤10kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/.size-limit.json)
[![GitHub license](https://img.shields.io/github/license/ailuracollective/nestjs-hono-adapter.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

An HTTP adapter that runs a NestJS application on
[Hono](https://hono.dev), with no Express or Fastify underneath.
The core is runtime-neutral; a **transport** decides how it is
served. The default is `@hono/node-server`, which runs on Node
and on Bun alike and is what this package has always served
through; `bunServer()` opts into Bun's own server instead.

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
versions. `@hono/node-server` is what the adapter serves through
when no transport is named, so it is required. A deployment that
serves WebSockets also installs `@hono/node-ws` and
`@nestjs/websockets`: those two are the optional peers, reached
through `./ws` and nowhere else.

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

Leaving `transport` out serves through `@hono/node-server` on
Node and on Bun — the runtime every deployment was served by
before the transports split — with `overrideGlobalObjects` on,
as it always was:

```ts
new ServerAdapter();
```

The same transport, named, is where that option lives too; the
`ServerAdapterOptions.overrideGlobalObjects` spelling is kept,
and is read only when no transport is named:

```ts
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';

new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: true }),
});
```

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

The fetch handler reads the client address from
`cf-connecting-ip`, returning `undefined` when it is absent.
`x-forwarded-for` is read only when `trustProxy` is enabled.

`getType()` answers `hono`, which is the value ecosystem
packages branch on.

## Options

| Option          | Type                            | Default | Effect                                                                           |
| --------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `bodyLimit`     | `number`                        | `1 MiB` | Largest request body, in bytes; `0` removes the limit                            |
| `rawBody`       | `boolean`                       | `false` | Keep the bytes that were read in `NestRequest.rawBody`                           |
| `secureHeaders` | `boolean \| object`             | `true`  | Install `hono/secure-headers`, with its defaults or with the given options       |
| `transport`     | `Transport`                     | —       | The runtime: `bunServer()`, `nodeServer()` or `fetchServer()`                    |
| `trustProxy`    | `boolean \| number \| string[]` | `false` | Read `x-forwarded-proto`, `x-forwarded-for` and `x-forwarded-host`               |
| `views`         | `object`                        | —       | The engine a `@Render()` handler renders with, and where templates are read from |

## Documentation

| Topic                                                        | What it covers                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [docs/platform-differences.md](docs/platform-differences.md) | Where Express and Fastify disagree, and how this adapter answers; routes, query strings, bodies, responses |
| [docs/features.md](docs/features.md)                         | Server-sent events, views, static assets, CORS, request-level security                                     |
| [docs/deployment.md](docs/deployment.md)                     | TLS, proxies, shutdown, the Hono API, WebSockets, microservices                                            |
| [docs/development.md](docs/development.md)                   | Requirements, build and test commands, release process                                                     |
| [docs/api.md](docs/api.md)                                   | API reference: classes, options, and types                                                                 |
| [docs/architecture.md](docs/architecture.md)                 | The layer map, import rules, bundle ceilings, and Node boundary                                            |
| [docs/bundle-baseline.md](docs/bundle-baseline.md)           | Verified bundle and package measurements, and what the evidence supports                                   |
| [examples/](examples/)                                       | Cloudflare Workers, Vercel, Cloud Run, and container examples — one application behind a transport         |

## Requirements

- Bun 1.2+ (toolchain), or Node 22.12+.
- `@hono/node-server`, which both serve through by default;
  `bunServer()` replaces it with Bun's own server.
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
  editing `src/`: it documents the layer map, import rules, and
  bundle ceilings.
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
