# @ailura/nestjs-hono-adapter

<!-- Badges: calidad, seguridad y confianza -->

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter)
[![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-hono-adapter.svg)](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter)
[![bundle size](https://img.shields.io/badge/bundle%20size-≤10kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/.size-limit.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![GitHub license](https://img.shields.io/github/license/ailuracollective/nestjs-hono-adapter.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

An HTTP adapter that runs a NestJS application on
[Hono](https://hono.dev), with no Express or Fastify underneath.

**Problem**: Nest has no official Hono adapter. The two
published alternatives target Nest 11 and answer incorrectly —
one returns a success status to a handler that threw, the other
writes every response twice.

**Solution**: This package implements the Nest 11/12
`AbstractHttpAdapter` contract directly on Hono. Routes are
registered on a Hono application, and Hono's Web `Request` and
`Response` are translated to and from the objects Nest reads and
writes.

**Solution**: This package implements the Nest 11/12
`AbstractHttpAdapter` contract directly on Hono. Routes are
registered on a Hono application, and Hono's Web `Request` and
`Response` are translated to and from the objects Nest reads and
writes.

## Install

```sh
npm install @ailura/nestjs-hono-adapter hono @hono/node-server
```

```sh
pnpm add @ailura/nestjs-hono-adapter hono @hono/node-server
```

`@nestjs/common`, `@nestjs/core`, `hono` and `@hono/node-server`
are peer dependencies, so the application decides their
versions.

## Use

```ts
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';

import { AppModule } from './app.module.ts';

const app = await NestFactory.create(
  AppModule,
  new ServerAdapter({
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  }),
);
app.enableCors({
  credentials: true,
  origin: ['https://app.example.com'],
});
await app.listen(3000);
```

`getType()` answers `hono`, which is the value ecosystem
packages branch on.

## Options

| Option                  | Type                            | Default | Effect                                                                                                               |
| ----------------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `bodyLimit`             | `number`                        | `1 MiB` | Largest request body, in bytes; `0` removes the limit                                                                |
| `overrideGlobalObjects` | `boolean`                       | `true`  | Let `@hono/node-server` swap the global `Request` and `Response` for lighter ones; turn it off on Cloudflare Workers |
| `rawBody`               | `boolean`                       | `false` | Keep the bytes that were read in `NestRequest.rawBody`                                                               |
| `secureHeaders`         | `boolean \| object`             | `true`  | Install `hono/secure-headers`, with its defaults or with the given options                                           |
| `trustProxy`            | `boolean \| number \| string[]` | `false` | Read `x-forwarded-proto`, `x-forwarded-for` and `x-forwarded-host`                                                   |
| `views`                 | `object`                        | —       | The engine a `@Render()` handler renders with, and where templates are read from                                     |

## Documentation

| Topic                                                        | What it covers                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [docs/platform-differences.md](docs/platform-differences.md) | Where Express and Fastify disagree, and how this adapter answers; routes, query strings, bodies, responses |
| [docs/features.md](docs/features.md)                         | Server-sent events, views, static assets, CORS, request-level security                                     |
| [docs/deployment.md](docs/deployment.md)                     | TLS, proxies, shutdown, the Hono API, WebSockets, microservices                                            |
| [docs/development.md](docs/development.md)                   | Requirements, build and test commands, release process                                                     |
| [docs/architecture.md](docs/architecture.md)                 | The layer map, import rules, bundle ceilings, and Node boundary                                            |
| [docs/lint-exceptions.md](docs/lint-exceptions.md)           | The lint rules this repository disables and why                                                            |

## Requirements

- Node 22.12 or later (22.x and 24.x tested; 26.x ready as it
  enters LTS).
- Nest 11 or 12.
- Hono 4 and `@hono/node-server` 2.

## Development

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` is exactly what CI runs: lint, format,
typecheck, test, build and the bundle size gate.

## Contributing

Contributions are welcome via [pull requests](https://github.com/ailuracollective/nestjs-hono-adapters/pulls).

### Contribution requirements

- Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (enforced by semantic-release).
- Run `bun run check` before opening a PR — it must pass lint, format, typecheck, test, build, and the bundle size gate.
- Read [docs/architecture.md](docs/architecture.md) before editing `src/`: it documents the layer map, import rules, and bundle ceilings.
- Tests must cover new behaviour; the suite runs against both Nest 11 and 12 on Node 22 and 24.

## Reporting issues

Open an [issue](https://github.com/ailuracollective/nestjs-hono-adapters/issues) for bugs or feature requests. Include the Nest and Hono versions, a minimal reproduction, and the behaviour you expected versus what happened.

## Contributing

Contributions are welcome via
[pull requests](https://github.com/ailuracollective/nestjs-hono-adapter/pulls).

### Contribution requirements

- Follow the
  [Conventional Commits](https://www.conventionalcommits.org/)
  specification (enforced by semantic-release).
- Run `bun run check` before opening a PR — it must pass lint,
  format, typecheck, test, build, and the bundle size gate.
- Read [docs/architecture.md](docs/architecture.md) before
  editing `src/`: it documents the layer map, import rules, and
  bundle ceilings.
- Tests must cover new behaviour; the suite runs against both
  Nest 11 and 12 on Node 22 and 24.

## Reporting issues

Open an
[issue](https://github.com/ailuracollective/nestjs-hono-adapter/issues)
for bugs or feature requests. Include the Nest and Hono
versions, a minimal reproduction, and the behaviour you expected
versus what happened.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting
process.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting
process.

## License

MIT
