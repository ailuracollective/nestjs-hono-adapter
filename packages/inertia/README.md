# @ailura/nestjs-platform-hono-inertia

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-inertia.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-inertia) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-inertia.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-inertia) [![bundle size](https://img.shields.io/badge/bundle%20size-≤1kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/inertia/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-inertia)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-inertia) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![codecov](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter/branch/main/graph/badge.svg?component=inertia)](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

The Inertia.js bridge of [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter). It makes the **stock** [`@dudousxd/nestjs-inertia`](https://www.npmjs.com/package/@dudousxd/nestjs-inertia) module answer on Hono.

It is a **compatibility bridge**: installing the package is what installs it, and an application writes no import of it. The adapter's compatibility region resolves the package out of your own tree and registers the bridge it publishes, so the application names nothing from here.

`InertiaModule` registers its middleware only when `httpAdapter.getType() === 'express'`, and its interceptors read the Express response members `headersSent`, `statusCode` and `redirect`. On Hono neither is true. This package registers the stock middleware, fits those members onto the Hono context, keeps Nest's post-handler from overwriting a page Inertia already wrote, and upgrades a `302` after `PUT`, `PATCH`, `DELETE` or `QUERY` to `303` so `@Redirect()` agrees with Inertia.

## Install

```sh
bun add @ailura/nestjs-platform-hono-inertia
```

Peers on `@dudousxd/nestjs-inertia` and on `@ailura/nestjs-hono-adapter` (`>=2 <3`); the adapter is never named in the module, only reached through it.

## Use

```ts
import { Module } from '@nestjs/common';
import { InertiaModule } from '@dudousxd/nestjs-inertia';

@Module({
  imports: [InertiaModule.forRoot({ version: 'v1' })],
})
export class AppModule {}
```

The application names the stock module and imports nothing from here. An `@Inertia()` action needs no `@Res()`: the bridge keeps the page body Nest would otherwise overwrite.

## What it covers

- `@Inertia('Page')` on the stock render interceptor, including partial reloads (`X-Inertia-Partial-Data` / `-Except` / `-Reset`), deferred props, once props and history flags.
- `req.inertia.render()`, `share()`, `location()`, `encryptHistory()` and `clearHistory()`.
- The first-load root document, through the stock shell.
- `@Redirect()` and `res.redirect()` after a `PUT`, `PATCH`, `DELETE` or `QUERY` request, upgraded to `303` for an Inertia visit.
- `X-Inertia-Version` mismatch, answered by the stock module as `409`.

Server-side rendering and the stock module's own options are untouched: the bridge changes the transport, not the Inertia protocol.

## Documentation

[docs/compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md#inertia) — what the bridge patches, and what it costs.

## License

MIT
