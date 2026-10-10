# Optional features

The capabilities a deployment may turn on: event streams, views,
static assets, CORS, request-level security and Swagger.

## Contents

- [Server-sent events](#server-sent-events)
- [Views](#views)
- [Static assets](#static-assets)
- [CORS](#cors)
- [Request-level security](#request-level-security)
- [Swagger](#swagger)

## Server-sent events

`@Sse()` is served like any other route, and its frames reach
the client as the observable emits them rather than when it
completes:

```ts
@Sse('events')
events(): Observable<MessageEvent> {
  return interval(1000).pipe(
    map((n) => ({ data: { n }, id: String(n) })),
  );
}
```

The answer carries `content-type: text/event-stream` and the
frame shape is Nest's: `data`, with an object serialised as
JSON, and, when present, `type` as `event:`, `id`, `retry` and
`comment`. A handler may answer an observable or a promise of
one, and `@Header()` reaches the stream. The status is the one
Nest computed for the route: `200` by default, and `@HttpCode()`
on the versions that carry it (11.2 and later).

A stream that fails before its first frame is answered by the
exception layer like any other failure; one that fails after a
frame has been sent ends the stream with an `error` event. A
client that disconnects unsubscribes the observable, so its
teardown runs and nothing is left ticking — and, on Nest 11.2
and later, the abort signal `@SseSignal()` injects is aborted at
the same moment. `app.close()` waits for an open stream to
finish unless `forceCloseConnections` is set, the same way it
waits for any long-lived request.

A client that walks away is noticed however the runtime says it:
by the request ending, by the stream's own reader being
cancelled, and by the request's signal aborting. The adapter
watches that signal on every request and ends the stream when it
fires, so a deployment does not have to wire it up itself.

## Views

Rendering is left to the deployment: this adapter reads the
template and a function renders it, so no template engine
becomes a dependency of the package.

```ts
import handlebars from 'handlebars';

const adapter = new ServerAdapter({
  views: {
    directory: 'views',
    engine: (source, data) => handlebars.compile(source)(data),
  },
});
```

`engine` receives the template source and the object the handler
returned, and may answer a promise, so any engine fits. The same
two things can be named on the application, which is what Nest
declares for the purpose:

```ts
app.setBaseViewsDir('views');
app.setViewEngine('hbs');
```

A handler marks its route with `@Render('hello')`, and the
extension the engine named is appended, so the file looked up is
`views/hello.hbs`. A view that is missing is answered as
`NotFoundException`, and naming an engine before one was
configured throws, rather than rendering an empty page.

## Static assets

`app.useStaticAssets(path, options)` mounts one directory, or a
list of them, on Hono's own static handler. A request that names
no file in them travels on to the routes, so an application
keeps its own not-found answer.

```ts
app.useStaticAssets('public', {
  maxAge: '7d',
  prefix: '/public',
});
```

| Option      | Effect                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `prefix`    | Where the files hang; without it, the root                                                                                    |
| `index`     | File a directory request is answered with; `index.html` unless set                                                            |
| `maxAge`    | Writes `cache-control: public, max-age=…`; a number is milliseconds, a string is read as `ms`, `s`, `m`, `h`, `d`, `w` or `y` |
| `immutable` | Adds `immutable` to that header, and needs `maxAge`                                                                           |

`redirect` is accepted and not acted on: a directory request is
answered with its index whether or not the path ends in a slash,
so a redirect would only add a round trip. The options Hono's
handler decides for itself are refused when they are passed, so
a deployment is told at startup rather than noticing later:
`setHeaders`, `extensions`, `fallthrough: false`, `dotfiles`,
`index: false`, `etag: false`, and `immutable` without a
`maxAge`. An ETag is always written.

## CORS

`app.enableCors()` records the options instead of installing
Nest's Express middleware: the adapter answers with Hono's own
`cors` in front of every route.

An origin may be a string, a list, a regular expression, `'*'`,
or a callback in the shape Nest documents:

```ts
app.enableCors({
  origin: (origin, respond) => {
    respond(
      undefined,
      allowed.has(origin ?? '') ? origin : false,
    );
  },
});
```

The callback runs once per request, may answer an error to fail
the request outright, and is awaited, so an asynchronous
decision works. `preflightContinue: true` answers nothing
itself: the preflight headers are copied onto the response and
the router answers, which is what an application with its own
`OPTIONS` route wants.

What the middleware answers when nothing is named follows the
platform adapters: a preflight reflects the
`Access-Control-Request-Headers` it arrived with rather than a
list the deployment never wrote, a `max-age` of a day goes out
by default, and an origin of `'*'` is answered literally, with
no `Vary: Origin` to cache around it. An origin named with
`true` or with a list is echoed back instead, which is what a
deployment with credentials needs.

Allowed origins are passed in by the application, which reads
them from its own configuration. This package reads no
environment variable, so one deployment policy is not baked into
the library.

## Request-level security

`secureHeaders: true` installs `hono/secure-headers` for the
answers the adapter builds, which the platform adapters do not
do by default.

Nest's own request-level security features — the security
headers and the CSRF check it calls through
`registerSecurityHook()` — are registered as Hono middleware in
front of every route. The hook is handed the request it reads
and the raw response it writes, the same two objects the Fastify
adapter gives it, and the transport merges the headers it sets
into whatever the route answers.

The hook is installed as an own property rather than declared as
a method: `AbstractHttpAdapter` declares it only in Nest
versions published after 12.0.3, and this package compiles
against `>=11 <13`, so one build has to answer a Nest that
declares the method and one that does not.

## Swagger

`@nestjs/swagger` works on this adapter as it does on Express
and Fastify. `SwaggerModule.setup()` serves the UI, the
bootstrap script and the JSON/YAML documents:

```ts
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Catalog')
    .setVersion('1.0')
    .build(),
);
SwaggerModule.setup('docs', app, document);
```

No configuration is needed, and the UI assets are served through
`useStaticAssets()` at the path the setup named.

### What the adapter provides

A Nest module can register a route on the HTTP adapter itself,
and it receives the Hono context as its Express-shaped `res`.
Some modules — `@nestjs/swagger` among them — write to that
object with `res.type()` and `res.send()`, which a Hono context
does not carry. Without them such a route answers `500`.

The adapter installs both on the Hono context prototype, once
per process, in `src/core/express-surface.ts`:

- `res.type(value)` writes `Content-Type` and returns the
  context, as Express does for chaining.
- `res.send(body)` answers the body through the same writer
  every other answer goes through, honouring a status Nest set
  first and falling back to `200`.

The install is guarded on the prototype already answering
`send`, so a second application in the same process, or a
runtime that ships the method itself, is left alone. This is
part of the translation rather than a Swagger-specific shim: any
module that registers a route on the adapter this way gets the
same surface.

### What it does not provide

Express's `res.type()` also accepts a shorthand such as `json`
and expands it through a media type table. That table is not
carried: no module that registers a route on the adapter uses a
shorthand, and the bytes are spent on the `index` entrypoint,
which has no headroom to spare. Write the full type where it is
read.
