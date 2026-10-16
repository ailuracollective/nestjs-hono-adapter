# Optional features

## Server-sent events

`@Sse()` is served like any other route, and its frames reach the client as the observable emits them, not when it completes:

```ts
@Sse('events')
events(): Observable<MessageEvent> {
  return interval(1000).pipe(
    map((n) => ({ data: { n }, id: String(n) })),
  );
}
```

The answer carries `content-type: text/event-stream`, and the frame shape is Nest's: `data` — an object serialised as JSON — and, when present, `type` as `event:`, `id`, `retry` and `comment`. A handler may answer an observable or a promise of one, and `@Header()` reaches the stream. The status is Nest's for the route: `200` by default, and `@HttpCode()` on the versions that carry it (11.2 and later).

A stream failing before its first frame goes to the exception layer like any other failure; one failing after a frame ends the stream with an `error` event. A disconnecting client unsubscribes the observable, so its teardown runs and nothing is left ticking; on Nest 11.2 and later the `@SseSignal()` abort signal is aborted then. `app.close()` waits for an open stream unless `forceCloseConnections` is set, as for any long-lived request. A client that walks away is noticed however the runtime says it; the adapter watches that signal on every request and ends the stream when it fires.

## Views

Rendering is left to the deployment: the adapter reads the template and a function renders it, so no engine becomes a package dependency.

```ts
import handlebars from 'handlebars';

const adapter = new ServerAdapter({
  views: {
    directory: 'views',
    engine: (source, data) => handlebars.compile(source)(data),
  },
});
```

`engine` receives the template source and the object the handler returned, and may answer a promise, so any engine fits. Both it and `directory` can also be named on the application (`app.setBaseViewsDir`, `app.setViewEngine`).

`setLocal(key, value)` adds one value to every render. Locals are stored separately from `setViewEngine({ defaultContext })` defaults, so configuring defaults preserves them. Render data combines defaults, locals, and handler data in that order, later values winning. Every local key, including `__proto__`, is ordinary own data.

`set(name, value)` reaches the settings this adapter honours — `view engine` and `views`, the two calls above: both accept a string, and `views` also a string array searched in order. `enable(name)` / `disable(name)` call it with `true` and `false`. A name with no behaviour behind it is refused with the reason rather than stored.

A handler marks its route with `@Render('hello')`, and the engine's extension is appended, so the file looked up is `views/hello.hbs`. A missing view is answered as `NotFoundException`. Naming the engine (`setViewEngine('hbs')`) resolves it on first render: the module `hbs` is imported and adapted — a `(source, data)` function, or one carrying `render`. A module that will not load, or answers nothing callable, fails that render with a `TypeError`. The answer carries the status the route declared — `@HttpCode(HttpStatus.ACCEPTED)` with `@Render()` answers `202`, and a route declaring none answers the method's status: `200` for `GET`, `201` for `POST`.

## Static assets

`app.useStaticAssets(path, options)` mounts one directory, or a list, on Hono's own static handler. A request naming no file travels on to the routes, so an application keeps its own not-found answer.

| Option | Effect |
| --- | --- |
| `prefix` | Where the files hang; without it, the root |
| `index` | File a directory request is answered with; `index.html` unless set |
| `maxAge` | Writes `cache-control: public, max-age=…`; a number is milliseconds, a string is read as `ms`, `s`, `m`, `h`, `d`, `w` or `y` |
| `immutable` | Adds `immutable` to that header, and needs `maxAge` |

`redirect` is accepted but not acted on: a directory request is answered with its index whether or not the path ends in a slash. The options Hono's handler decides for itself are refused when passed, so a deployment is told at startup: `setHeaders`, `extensions`, `fallthrough: false`, `dotfiles`, `index: false`, `etag: false`, and `immutable` without a `maxAge`. An ETag is always written.

`@nestjs/serve-static` is served by the same machinery through a compatibility bridge, so the refusal above applies to its `serveStaticOptions` too. See [compatibility.md](compatibility.md#what-is-refused-and-why).

## CORS

`app.enableCors()` records the options instead of installing Nest's Express middleware: the adapter answers with Hono's own `cors` in front of every route. Called with no options it names no origin, and naming no origin allows every one — `Access-Control-Allow-Origin: *`, the default the `cors` package and `@fastify/cors` document and both platform adapters inherit. That differs from `origin: false`, which allows none.

An origin may be a string, a list, a regular expression, `'*'`, or a callback in the shape Nest documents:

```ts
app.enableCors({
  origin: (origin, respond) => {
    respond(undefined, allowed.has(origin ?? '') ? origin : false);
  },
});
```

The callback runs once per request, is awaited, and may answer an error to fail the request. `preflightContinue: true` answers nothing itself: the preflight headers are copied onto the response and the router answers, which an application with its own `OPTIONS` route wants.

With nothing named, the middleware follows the platform adapters: a preflight reflects the `Access-Control-Request-Headers` it arrived with, a `max-age` of a day goes out by default, and an origin of `'*'` is answered literally with no `Vary: Origin`. An origin named `true` or as a list is echoed back instead.

Allowed origins are passed in by the application from its own configuration; the package reads no environment variable, so no one deployment policy is baked in.

## Request-level security

`secureHeaders: true` installs `hono/secure-headers` for the answers the adapter builds; it is off by default, so the adapter sends no more headers than the platform adapters do. Passing an options object installs it with those options instead of the defaults.

Nest's own request-level security — the security headers and the CSRF check reached through `registerSecurityHook()` — is registered as Hono middleware in front of every route. The hook is handed the request it reads and the raw response it writes, the same two objects the Fastify adapter gives it, and the transport merges the headers it sets into whatever the route answers.

It is installed as an own property rather than a method: `AbstractHttpAdapter` declares it only after 12.0.3, and the package compiles `>=11 <13`, so one build must answer a Nest that declares it and one that does not.

## Uploads

`multipart/form-data` bodies are handled by `@ailura/nestjs-platform-hono-multipart`, which parses them with multer's semantics on top of `busboy` (an optional peer). Import it only where an application accepts an upload; the HTTP entrypoint never loads it.

```ts
import {
  FileInterceptor,
  type UploadedMultipartFile,
} from '@ailura/nestjs-platform-hono-multipart';

@Post('avatar')
@UseInterceptors(FileInterceptor('file'))
upload(@UploadedFile() file: UploadedMultipartFile) {
  return { size: file.size };
}
```

`FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor`, `AnyFilesInterceptor`, `NoFilesInterceptor` and `FileStreamInterceptor` mirror the platform-express names and fill `req.file` / `req.files` / `req.body`, but follow `@nestjs/platform-fastify/multipart`, not `@nestjs/platform-express/multer`: only the interceptor names and option keys match Express. The types are this package's own: `UploadedMultipartFile`, `MultipartFileStream` and `MultipartOptions` (`storage`, `limits`, `fileFilter`, `preservePath`, `defParamCharset`). `MultipartModule.register()` provides defaults; `memoryStorage()` and `diskStorage()` are shipped, and a platform-express engine works unchanged.

`FileStreamInterceptor` stores nothing, the counterpart of Fastify's interceptor of the same name: the handler is handed a `MultipartFileStream` whose `stream` carries the bytes as they arrive, so a file larger than memory or disk is piped straight through.

Only what the handler reads is taken from the client, and the unread is discarded once it answers, so a client still uploading is never left hanging. The text fields must precede the file: the parts after it are read and discarded rather than parsed. The size is unknown when the handler runs, so `MaxFileSizeValidator` and `FileTypeValidator`'s magic-number check do not apply; `limits.fileSize` is enforced on the stream instead, erroring with a `PayloadTooLargeException`.

Importing the island marks the adapter, so the request path leaves a multipart body for the interceptor to consume rather than parsing it. A multipart route **without** an interceptor therefore reads no `body` and no `files` — the rule `@nestjs/platform-fastify` follows. Serve `busboy` where Node streams run (the Node and Bun transports); on a fetch host the request path keeps parsing the body into `body` and `files`.

## Swagger

`@nestjs/swagger` works on this adapter as on Express and Fastify; `SwaggerModule.setup()` serves the UI, the bootstrap script and the JSON/YAML documents:

```ts
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder().setTitle('Catalog').setVersion('1.0').build(),
);
SwaggerModule.setup('docs', app, document);
```

No configuration is needed, and the UI assets are served through `useStaticAssets()` at the path the setup named.

### What the adapter provides

A Nest module can register a route on the HTTP adapter itself, and it receives the Hono context as its Express-shaped `res`. Some modules — `@nestjs/swagger` among them — write to that object with `res.type()` and `res.send()`, which a Hono context does not carry. Without them such a route answers `500`.

The adapter installs both on the Hono context prototype, once per application, in `packages/core/src/compat/express/`:

- `res.type(value)` writes `Content-Type` and returns the context, as Express does for chaining.
- `res.send(body)` answers the body through the same writer every other answer goes through, honouring a status Nest set first and falling back to `200`. A **string** goes out as `text/html`, as Express reads `res.send(html)` and as a module handing over a page means it. A type declared through `res.type()` is left alone.

The string reading is the surface's, not the adapter's: the body a Nest _handler returns_ is labelled by the writer, the Fastify reading [the differences table](platform-differences.md) records. Only the path serving a module that registers a route this way follows Express here.

The install is guarded on the prototype already answering `send`, so a second application in the same process, or a runtime shipping the method itself, is left alone. It is part of the translation, not a Swagger-specific shim: any module that registers a route on the adapter this way gets the same surface.

### What it does not provide

Express's `res.type()` also accepts a shorthand such as `json` and expands it through a media type table. That table is not carried: no module that registers a route on the adapter uses a shorthand. Write the full type where it is read.
