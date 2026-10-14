# @ailura/nestjs-platform-hono-serve-static

The static-asset bridge of
[`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter).
It makes the **stock**
[`@nestjs/serve-static`](https://www.npmjs.com/package/@nestjs/serve-static)
module serve files on Hono, through the adapter's transport.

`ServeStaticModule` builds an Express router and mounts it on
the adapter's HTTP server, reading files through
`express.static` and `res.sendFile`. On Hono neither exists.
This package swaps that module's loader for one that serves
every directory through `transport.serveStatic()`, and answers
the SPA fallback with one Hono middleware that reads the index
file through the same call.

## You write no import

Installing the package is what installs the bridge. The
adapter's compatibility region resolves the package out of your
own tree and registers the bridge it publishes, so an
application names nothing from here:

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

## Install

```sh
bun add @ailura/nestjs-platform-hono-serve-static
```

Peers on `@nestjs/serve-static`; it does nothing without it.

## `setHeaders` is refused

The hook is handed an `fs.Stats` and an Express response, and no
transport here builds either — a fetch host has no filesystem at
all. Rather than honour the hook on Node and ignore it
elsewhere, the loader throws a `TypeError` that names the
option.

## See also

[docs/compatibility.md](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/compatibility.md)
— the region, the discovery, and what a bridge costs.
