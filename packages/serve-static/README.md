# @ailura/nestjs-platform-hono-serve-static

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-serve-static.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-serve-static) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-serve-static.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-serve-static) [![bundle size](https://img.shields.io/badge/bundle%20size-≤1.9kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/serve-static/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-serve-static)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-serve-static) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![codecov](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter/branch/main/graph/badge.svg?component=serve-static)](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

The static-asset bridge of [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter). It makes the **stock** [`@nestjs/serve-static`](https://www.npmjs.com/package/@nestjs/serve-static) module serve files on Hono, through the adapter's transport.

It is a **compatibility bridge**: installing the package is what installs it, and an application writes no import of it. The adapter's compatibility region resolves the package out of your own tree and registers the bridge it publishes, so the application names nothing from here.

`ServeStaticModule`'s Express loader mounts `express.static` middleware and a render function on the Express application, reading files through `express.static` and `res.sendFile`. On Hono neither exists. This package swaps that module's loader for one that serves every directory through `transport.serveStatic()`, and answers the SPA fallback with one Hono middleware that reads the index file through the same call.

## Install

```sh
bun add @ailura/nestjs-platform-hono-serve-static
```

Peers on `@nestjs/serve-static`, which it does nothing without, and on `@ailura/nestjs-hono-adapter` (`>=2 <3`); the adapter is never named in the module, only reached through it.

## Use

```ts
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
    }),
  ],
})
export class AppModule {}
```

The application names the stock module and imports nothing from here.

## Options

`rootPath` names the directory and `serveRoot` the prefix it answers under; `exclude` takes a string, a regular expression or a list of them, and `useGlobalPrefix` mounts the directory under the application's global prefix. Inside `serveStaticOptions`, `index` names the index file — `false` means `index.html` — and `fallthrough` is honoured, where the adapter's own static handler refuses it.

## `setHeaders` is refused

The hook is handed an `fs.Stats` and an Express response, and no transport here builds either — a fetch host has no filesystem at all. Rather than honour the hook on Node and ignore it elsewhere, the loader throws a `TypeError` that names the option.

## Documentation

[docs/compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md#serve-static) — what the bridge patches, and what it costs.

## License

MIT
