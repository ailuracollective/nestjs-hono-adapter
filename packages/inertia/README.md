# @ailura/nestjs-platform-hono-inertia

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-inertia.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-inertia) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-inertia.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-inertia) [![bundle size](https://img.shields.io/badge/bundle%20size-≤0.9kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/inertia/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-inertia)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-inertia) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![codecov](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter/branch/main/graph/badge.svg?component=inertia)](https://codecov.io/gh/ailuracollective/nestjs-hono-adapter) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

The Inertia bridge of [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter). It makes the **stock** [`@dudousxd/nestjs-inertia`](https://www.npmjs.com/package/@dudousxd/nestjs-inertia) module render pages, preserve its response and answer redirects on Hono.

It is a **compatibility bridge**: installing the package is what installs it, and an application writes no import of it. The adapter's compatibility region resolves the package out of your own tree and registers the bridge it publishes, so the application names nothing from here.

`InertiaModule` mounts its middleware only when the adapter reports `express`, and its interceptors read Express response members. On Hono the middleware never ran, `req.inertia` was missing and a rendered page was overwritten by Nest's post-handler. This package patches the module's `configure()`, fits the response members the module reads per request, and patches the application's own `reply()` and `redirect()` so an Inertia render and a `302` survive.

## Install

```sh
bun add @ailura/nestjs-platform-hono-inertia
```

Peers on `@dudousxd/nestjs-inertia` 3.x, on `rxjs` and on `@ailura/nestjs-hono-adapter` (`>=2 <3`); the adapter is never named in the module, only reached through it. The Inertia peer is required and imported when the package is evaluated, because the module patch has to be in place before Nest calls `configure()`.

## Use

```ts
import { Module } from '@nestjs/common';
import { InertiaModule } from '@dudousxd/nestjs-inertia';

@Module({
  imports: [
    InertiaModule.forRoot({
      rootView: 'inertia/root.html',
      version: () => process.env.ASSET_VERSION ?? 'dev',
    }),
  ],
})
export class AppModule {}
```

The application names the stock module and imports nothing from here. A controller renders the same way it does on Express:

```ts
import { Controller, Get } from '@nestjs/common';
import { Inertia } from '@dudousxd/nestjs-inertia';

@Controller()
export class HomeController {
  @Get('/')
  @Inertia('Home')
  show() {
    return { greeting: 'hello' };
  }
}
```

## What it covers

A full browser visit renders the HTML shell and an Inertia visit renders the JSON page, both without `@Res()`. Partial reloads, deferred props, once props, a stale `X-Inertia-Version` and `location()` answer as they do on Express.

`@Redirect()` and both `res.redirect()` shapes preserve an explicit status and upgrade a `302` to `303` for an Inertia visit — a `PUT`, `PATCH` or `DELETE` carrying `X-Inertia`.

## Version guard

The bridge patches internals of the Inertia 3.x line. An installed Inertia outside 3.x is refused when the package is evaluated, with a message naming the version found.

SSR, CSRF, the flash store, error bags, merge and scroll props and multi-app `forFeature` coverage are follow-ups.

## Documentation

[docs/compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md#inertia) — what the bridge patches, and what it costs.

## License

MIT
