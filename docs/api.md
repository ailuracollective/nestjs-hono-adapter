# API Reference

This page documents the external interface of the package: the
classes, options, and types a consumer imports and uses.

## Entrypoints

| Entrypoint             | Purpose                               |
| ---------------------- | ------------------------------------- |
| `@ailura/nestjs-hono-adapter`     | HTTP adapter (`ServerAdapter`)        |
| `@ailura/nestjs-hono-adapter/ws`  | WebSocket adapter (`HonoWsAdapter`)   |

## HTTP Adapter

### `ServerAdapter`

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
```

The class handed to `NestFactory.create()`:

```ts
const app = await NestFactory.create(AppModule, new ServerAdapter(options));
```

### `ServerAdapterOptions`

| Option                  | Type                            | Default | Description                                                                                |
| ----------------------- | ------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `bodyLimit`             | `number`                        | `1 MiB` | Largest request body in bytes; `0` removes the limit                                       |
| `overrideGlobalObjects` | `boolean`                       | `true`  | Let `@hono/node-server` swap global `Request`/`Response` for lighter ones; turn off on Cloudflare Workers |
| `rawBody`               | `boolean`                       | `false` | Keep the bytes that were read in `NestRequest.rawBody`                                      |
| `secureHeaders`         | `boolean \| object`             | `true`  | Install `hono/secure-headers` with defaults or with the given options                        |
| `trustProxy`            | `boolean \| number \| string[]` | `false` | Read `x-forwarded-proto`, `x-forwarded-for`, `x-forwarded-host`                             |
| `views`                 | `ViewOptions`                   | —       | The engine a `@Render()` handler renders with, and where templates are read from            |

### Application methods

These methods are available on the `INestApplication` returned by
`NestFactory.create()` when using this adapter:

| Method                          | Signature                                                                              | Description                                      |
| ------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `enableCors`                    | `(options?: CorsOptions) => void`                                                      | Turns on the CORS middleware                     |
| `useStaticAssets`               | `(path: string \| readonly string[], options?: StaticAssetsOptions) => this`           | Serves the files in a directory under the prefix |
| `setBaseViewsDir`               | `(directory: string \| readonly string[]) => this`                                     | Names the directories a view is read from        |
| `setViewEngine`                 | `(engine: string) => void`                                                             | Names the engine by the extension it renders     |
| `getHono`                       | `() => NestHono`                                                                       | Returns the underlying Hono application          |
| `getType`                       | `() => string`                                                                         | Returns `'hono'`                                 |
| `isRouteOrderSensitive`         | `() => boolean`                                                                        | Returns `false` (Hono scores routes)             |

## WebSocket Adapter

### `HonoWsAdapter`

```ts
import { HonoWsAdapter } from '@ailura/nestjs-hono-adapter/ws';
```

Created internally by Nest when a `@WebSocketGateway()` is declared.
A gateway that asks for its own port or for a namespace is refused.

### `HonoGatewayOptions`

| Option      | Type     | Default | Description                    |
| ----------- | -------- | ------- | ------------------------------ |
| `path`      | `string` | `'/'`   | The path the gateway listens on |
| `namespace` | `string` | —       | Not supported (throws)         |

## Types

### `CorsOptions`

| Option                 | Type                                              | Default | Description                                          |
| ---------------------- | ------------------------------------------------- | ------- | ---------------------------------------------------- |
| `allowedHeaders`       | `string \| readonly string[]`                     | —       | Headers a browser may send                           |
| `credentials`          | `boolean`                                         | `false` | Allow credentials                                    |
| `exposedHeaders`       | `string \| readonly string[]`                     | —       | Headers a browser may read                           |
| `maxAge`               | `number`                                          | `86400` | Seconds a browser may reuse a preflight answer       |
| `methods`              | `string \| readonly string[]`                     | all     | Methods a browser may call                           |
| `optionsSuccessStatus` | `number`                                          | —       | Status for a preflight (must be `204` or omitted)    |
| `origin`               | `boolean \| string \| RegExp \| readonly (string \| RegExp)[] \| OriginCallback` | — | Allowed origins |
| `preflightContinue`    | `boolean`                                         | `false` | Forward the preflight to the route instead of answering it |

### `ViewOptions`

| Option       | Type                              | Default | Description                                    |
| ------------ | --------------------------------- | ------- | ---------------------------------------------- |
| `engine`     | `ViewEngine`                      | —       | The function that renders a template's source   |
| `directory`  | `string \| readonly string[]`     | `cwd`   | Where templates are read from                  |

### `StaticAssetsOptions`

| Option       | Type                        | Default      | Description                                          |
| ------------ | --------------------------- | ------------ | ---------------------------------------------------- |
| `prefix`     | `string`                    | —            | The prefix the assets hang under                     |
| `index`      | `string`                    | `index.html`| The index file a directory request is answered with  |
| `maxAge`     | `number \| string`          | —            | Cache lifetime (number in ms, or string like `'1d'`) |
| `immutable`  | `boolean`                   | `false`      | Mark the cache as immutable (requires `maxAge`)      |
| `redirect`   | `boolean`                   | `true`       | Redirect directory requests to the index             |

### `NestRequest`

The request object Nest reads. Key properties:

| Property     | Type                    | Description                              |
| ------------ | ----------------------- | ---------------------------------------- |
| `method`     | `string`                | HTTP method                              |
| `url`        | `string`                | The full URL                             |
| `originalUrl`| `string`                | Path plus query string                   |
| `path`       | `string`                | The pathname                             |
| `hostname`   | `string`                | The hostname                             |
| `protocol`   | `string`                | `'http'` or `'https'`                    |
| `secure`     | `boolean`               | Whether the connection is TLS            |
| `ip`         | `string \| undefined`   | The client IP                            |
| `ips`        | `string[]`              | Forwarded IPs                            |
| `headers`    | `Record<string, string>`| Request headers                          |
| `query`      | `ParsedQuery`           | Parsed query string                      |
| `params`     | `Record<string, string>`| Route parameters                         |
| `body`       | `unknown`               | Parsed request body                       |
| `rawBody`    | `Buffer \| undefined`   | Raw body bytes (when `rawBody: true`)    |
| `socket`     | `IncomingMessage['socket']` | The underlying socket                |

### `TrustProxy`

```ts
type TrustProxy = boolean | number | string[];
```

Controls which proxy headers are read:

- `false` — trust no proxy (default)
- `true` — trust all proxies
- `number` — trust N hops
- `string[]` — trust specific IPs or CIDR ranges

## Error behaviour

| Situation                          | Behaviour                                                        |
| ---------------------------------- | ---------------------------------------------------------------- |
| Gateway asks for its own port      | `TypeError` at startup                                           |
| Gateway asks for a namespace       | `TypeError` at startup                                           |
| `setViewEngine` without `views.engine` | `TypeError` at startup                                       |
| `render` without a configured engine | `TypeError` at request time                                    |
| `optionsSuccessStatus` ≠ `204`     | `TypeError` at startup (unless `preflightContinue: true`)        |
| `etag: false` on static assets     | `TypeError` at startup                                           |
| `setHeaders` on static assets      | `TypeError` at startup                                           |
