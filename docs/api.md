# API Reference

## Entrypoints

| Package                                  | Entrypoints                                     | Purpose                             |
| ---------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| `@ailura/nestjs-hono-adapter`            | `.`, `./bun-server`, `./node-server`, `./fetch` | The HTTP adapter and its transports |
| `@ailura/nestjs-platform-hono-multipart` | `.`                                             | Upload interceptors (multer-style)  |
| `@ailura/nestjs-platform-hono-ws`        | `.`                                             | WebSocket adapter (`HonoWsAdapter`) |
| `@ailura/nestjs-platform-hono-socket-io` | `.`                                             | Socket.IO adapter (`HonoIoAdapter`) |

`./ws` moved to its own package; `./multipart` and `./socket-io`
only ever existed on `main`. Install per the
[README](../packages/core/README.md#migrating-from-the-old-subpaths).

## HTTP Adapter

### `ServerAdapter`

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
```

```ts
const app = await NestFactory.create(
  AppModule,
  new ServerAdapter(options),
);
```

### `NestHonoApplication`

```ts
import type { NestHonoApplication } from '@ailura/nestjs-hono-adapter';
```

```ts
const app = await NestFactory.create<NestHonoApplication>(
  AppModule,
  new ServerAdapter(),
);

app.getHttpAdapter().getHono(); // NestHono
app.getHttpServer().address(); // Server & http.Server
```

`getHttpServer()` is `Server` (every transport) and Node's
`http.Server`, so `closeAllConnections()` and `'upgrade'`
compile; only the Node transport answers a real `http.Server`.

`NestFactory.create()` otherwise defaults to `INestApplication`,
whose `getHttpAdapter()` is the shared `HttpServer` contract and
`getHttpServer()` is `any`. This type narrows both and stays
assignable; not naming it costs nothing for `getHono()`
(declared on `HttpServer` — see
[Adapter methods](#adapter-methods)).
`TestingModule.createNestApplication()` takes the same argument.

### `ServerAdapterOptions`

| Option          | Type                            | Default       | Description                                                                           |
| --------------- | ------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| `bodyLimit`     | `number`                        | `1 MiB`       | Largest request body in bytes; `0` removes the limit                                  |
| `rawBody`       | `boolean`                       | `false`       | Keep the bytes that were read in `NestRequest.rawBody`                                |
| `secureHeaders` | `boolean \| object`             | `false`       | Install `hono/secure-headers` with defaults or with the given options; off by default |
| `transport`     | `Transport`                     | `bunServer()` | The runtime to serve through: `bunServer()`, `nodeServer()` or `fetchServer()`        |
| `trustProxy`    | `boolean \| number \| string[]` | `false`       | Read `x-forwarded-proto`, `x-forwarded-for`, `x-forwarded-host`                       |
| `views`         | `ViewOptions`                   | —             | The engine a `@Render()` handler renders with, and where templates are read from      |

### Transports

| Subpath                                   | Export                  | Runtime                                        |
| ----------------------------------------- | ----------------------- | ---------------------------------------------- |
| `@ailura/nestjs-hono-adapter/bun-server`  | `bunServer()`           | Bun's own server                               |
| `@ailura/nestjs-hono-adapter/node-server` | `nodeServer(options?)`  | `@hono/node-server`                            |
| `@ailura/nestjs-hono-adapter/fetch`       | `fetchServer(options?)` | A fetch host (Workers, Vercel Functions, Deno) |

`bunServer` is the default, so `new ServerAdapter()` serves
through `Bun.serve`. `nodeServer()` runs on Node and Bun and
takes two options. `autoCleanupIncoming` (default `true`) makes
`@hono/node-server` drain and destroy the socket of a request
whose body was never read; turn it off only for trusted clients,
such as behind a reverse proxy that always reads the body
through. `overrideGlobalObjects` (default `true`) is whether
`@hono/node-server` may swap the global `Request` and `Response`
for its lighter classes — the fastest path; the swap is
process-wide and not restored, so set it `false` to leave the
globals alone.

A transport carries a websocket helper only where the runtime
has one: `nodeServer` none, Bun only where `hono/bun` loads
(never on Node), so the `/ws` island falls back to
`@hono/node-ws`; an app serving no WebSocket never installs it.

`fetchServer` takes no port: `close()` does nothing and
`listen()` rejects naming the fetch host. Static assets and
WebSockets are host-specific: the host passes `serveStatic` and
`upgradeWebSocket`, and asking for one without it throws.
`fetchHandler(app)` wraps the Hono app as the exported `fetch`:

```ts
const adapter = new ServerAdapter({
  transport: fetchServer(),
});
const app = await NestFactory.create(AppModule, adapter);
await app.init();

export default { fetch: fetchHandler(adapter.getHono()) };
```

### Application methods

| Method            | Signature                                                                    | Description                                      |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `enableCors`      | `(options?: CorsOptions) => void`                                            | Turns on CORS; no options allows every origin    |
| `useStaticAssets` | `(path: string \| readonly string[], options?: StaticAssetsOptions) => this` | Serves the files in a directory under the prefix |
| `setBaseViewsDir` | `(directory: string \| readonly string[]) => this`                           | Names the directories a view is read from        |
| `setViewEngine`   | `(engine: string) => this`                                                   | Names the engine by the extension it renders     |
| `setLocal`        | `(key: string, value: unknown) => this`                                      | Adds one value to every template render          |
| `set`             | `(name: string, value: unknown) => this`                                     | Honours the settings that name behaviour         |
| `enable`          | `(name: string) => this`                                                     | `set(name, true)`                                |
| `disable`         | `(name: string) => this`                                                     | `set(name, false)`                               |

Express's `app.get(name)` and `engine()` are absent: the first
collides with the container's `get()` and the GET registrar, the
second with `setViewEngine()`. Both are in
[platform-differences.md](platform-differences.md#what-this-adapter-does-not-implement).

### Adapter methods

| Method                  | Signature                                              | Description                                      |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| `getHono`               | `() => NestHono`                                       | The underlying Hono application                  |
| `getInstance`           | `<TInstance = NestHono>() => TInstance`                | The same application, typed rather than as `any` |
| `getType`               | `() => 'hono'`                                         | The identifier ecosystem packages branch on      |
| `isRouteOrderSensitive` | `() => boolean`                                        | Returns `false` (Hono scores routes)             |
| `useBodyParser`         | `(type?: string, rawBody?: boolean, options?) => void` | Reached by `app.useBodyParser()`                 |

`getHono` is declared on Nest's `HttpServer` by this package, so
it is reachable off an untyped application, but the declaration
covers every `HttpServer` (Express and Fastify included, which
lack it). Name [`NestHonoApplication`](#nesthonoapplication) —
it narrows the adapter instead of widening the contract.

## Uploads

### Interceptors

```ts
import {
  FileInterceptor,
  FileStreamInterceptor,
  FilesInterceptor,
  FileFieldsInterceptor,
  AnyFilesInterceptor,
  NoFilesInterceptor,
  MultipartModule,
  diskStorage,
  memoryStorage,
} from '@ailura/nestjs-platform-hono-multipart';
```

They parse `multipart/form-data` with multer's semantics —
`@UploadedFile()`→`req.file`, `@UploadedFiles()`→`req.files`,
text→`req.body` — like platform-express's family, same options.

| Interceptor             | Stores                                            |
| ----------------------- | ------------------------------------------------- |
| `FileInterceptor`       | One file in a named field → `req.file`            |
| `FilesInterceptor`      | Up to `maxCount` files in a named field → array   |
| `FileFieldsInterceptor` | Files in each of several fields → grouped by name |
| `AnyFilesInterceptor`   | Every file, any field → array                     |
| `NoFilesInterceptor`    | Text fields only; a file is a `400`               |
| `FileStreamInterceptor` | One file in a named field → a live stream         |

`FileStreamInterceptor(fieldName, localOptions?)` is the
streaming counterpart of `@nestjs/platform-fastify/multipart`'s
interceptor and stores nothing: `@UploadedFile()` reads a
`MultipartFileStream` whose `stream` carries the bytes as they
arrive. Only what the handler reads is taken, and the unread is
discarded once it answers, so a client still uploading is never
left hanging. Its options omit `dest` and `storage`, and
`limits.fileSize` is enforced on the stream, not the request.

`MultipartModule.register(options)` (and `registerAsync`)
provides module-wide defaults every interceptor merges over.

### Upload options

| Option            | Type                                            | Default  | Description                               |
| ----------------- | ----------------------------------------------- | -------- | ----------------------------------------- |
| `dest`            | `string`                                        | —        | Folder for disk storage when no `storage` |
| `storage`         | `MultipartStorageEngine`                        | memory   | The engine that stores each file          |
| `limits`          | `MultipartLimits \| ((req) => MultipartLimits)` | —        | Size and count ceilings, as multer's      |
| `preservePath`    | `boolean`                                       | `false`  | Keep the whole path a file arrived with   |
| `defParamCharset` | `string`                                        | `latin1` | Charset for part header values            |
| `fileFilter`      | `(req, file, cb) => void`                       | —        | Accept or refuse each file                |

`memoryStorage()` keeps each file in `file.buffer`;
`diskStorage({ destination, filename })` writes it and sets
`destination`, `filename` and `path`. Both implement multer's
`_handleFile`/`_removeFile` contract, so a platform-express
engine works unchanged.

The adapter's `bodyLimit` is counted as the payload is read, so
a body over it is answered `413` under any framing, even a
chunked one with no `Content-Length`. A multipart body is the
exception: a parser consumes it. Where
`@ailura/nestjs-platform-hono-multipart` is imported, the
island's `busboy` reads it, so the route's `limits` are the
ceiling while it is parsed and `bodyLimit` still refuses a
declared length already over it; otherwise Hono's own parser
counts no ceiling.

The island needs `busboy` (an optional peer) and works where
Node streams do — Node and Bun; a fetch host instead parses
`multipart/form-data` into `req.body` and `req.files` through
Hono's parser.

## WebSocket Adapter

### `HonoWsAdapter`

```ts
import { HonoWsAdapter } from '@ailura/nestjs-platform-hono-ws';
```

Created internally by Nest for a `@WebSocketGateway()`.

### `HonoGatewayOptions`

| Option      | Type     | Default | Description                     |
| ----------- | -------- | ------- | ------------------------------- |
| `path`      | `string` | `'/'`   | The path the gateway listens on |
| `namespace` | `string` | —       | Not supported (throws)          |

## Types

### `CorsOptions`

| Option                 | Type                                                                             | Default | Description                                                |
| ---------------------- | -------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `allowedHeaders`       | `string \| readonly string[]`                                                    | —       | Headers a browser may send                                 |
| `credentials`          | `boolean`                                                                        | `false` | Allow credentials                                          |
| `exposedHeaders`       | `string \| readonly string[]`                                                    | —       | Headers a browser may read                                 |
| `maxAge`               | `number`                                                                         | `86400` | Seconds a browser may reuse a preflight answer             |
| `methods`              | `string \| readonly string[]`                                                    | all     | Methods a browser may call                                 |
| `optionsSuccessStatus` | `number`                                                                         | —       | Status for a preflight (must be `204` or omitted)          |
| `origin`               | `boolean \| string \| RegExp \| readonly (string \| RegExp)[] \| OriginCallback` | —       | Allowed origins                                            |
| `preflightContinue`    | `boolean`                                                                        | `false` | Forward the preflight to the route instead of answering it |

### `ViewOptions`

| Option      | Type                          | Default | Description                                   |
| ----------- | ----------------------------- | ------- | --------------------------------------------- |
| `engine`    | `ViewEngine`                  | —       | The function that renders a template's source |
| `directory` | `string \| readonly string[]` | `cwd`   | Where templates are read from                 |

### `StaticAssetsOptions`

| Option      | Type               | Default      | Description                                          |
| ----------- | ------------------ | ------------ | ---------------------------------------------------- |
| `prefix`    | `string`           | —            | The prefix the assets hang under                     |
| `index`     | `string`           | `index.html` | The index file a directory request is answered with  |
| `maxAge`    | `number \| string` | —            | Cache lifetime (number in ms, or string like `'1d'`) |
| `immutable` | `boolean`          | `false`      | Mark the cache as immutable (requires `maxAge`)      |
| `redirect`  | `boolean`          | `true`       | Redirect directory requests to the index             |

### `MultipartFileStream`

| Property       | Type       | Description                             |
| -------------- | ---------- | --------------------------------------- |
| `fieldname`    | `string`   | Field name the file arrived under       |
| `originalname` | `string`   | Name of the file on the client, as sent |
| `encoding`     | `string`   | Transfer encoding the part declared     |
| `mimetype`     | `string`   | Media type the part declared            |
| `stream`       | `Readable` | The bytes, live from the request        |

### `NestRequest`

| Property      | Type                                                         | Description                                                         |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `method`      | `string`                                                     | HTTP method                                                         |
| `url`         | `string`                                                     | The full URL                                                        |
| `originalUrl` | `string`                                                     | Path plus query string                                              |
| `path`        | `string`                                                     | The pathname                                                        |
| `hostname`    | `string`                                                     | The hostname                                                        |
| `protocol`    | `string`                                                     | `'http'` or `'https'`                                               |
| `secure`      | `boolean`                                                    | Whether the connection is TLS                                       |
| `ip`          | `string \| undefined`                                        | The client IP                                                       |
| `ips`         | `string[]`                                                   | Forwarded IPs                                                       |
| `headers`     | `Record<string, string>`                                     | Request headers                                                     |
| `query`       | `ParsedQuery`                                                | Parsed query string                                                 |
| `params`      | `Record<string, string>`                                     | Route parameters                                                    |
| `body`        | `unknown`                                                    | Parsed request body                                                 |
| `rawBody`     | `Buffer \| undefined`                                        | Raw body bytes (when `rawBody: true`)                               |
| `file`        | `unknown`                                                    | The upload an interceptor stored, or the live stream it handed over |
| `files`       | `Record<string, unknown> \| readonly unknown[] \| undefined` | The uploads an interceptor stored                                   |
| `socket`      | `Socket`                                                     | The request's socket, as the runtime reports it                     |

### `TrustProxy`

```ts
type TrustProxy = boolean | number | string[];
```

- `false` — trust no proxy (default)
- `true` — trust all proxies
- `number` — trust N hops
- `string[]` — trust specific IPs or CIDR ranges

## Error behaviour

| Situation                              | Behaviour                                                 |
| -------------------------------------- | --------------------------------------------------------- |
| Gateway asks for its own port          | `TypeError` at startup                                    |
| Gateway asks for a namespace           | `TypeError` at startup                                    |
| `setViewEngine` without `views.engine` | `TypeError` at startup                                    |
| `render` without a configured engine   | `TypeError` at request time                               |
| `optionsSuccessStatus` ≠ `204`         | `TypeError` at startup (unless `preflightContinue: true`) |
| `etag: false` on static assets         | `TypeError` at startup                                    |
| `setHeaders` on static assets          | `TypeError` at startup                                    |
