# Platform differences, routes, bodies and responses

How this adapter answers where Nest's own platform adapters
disagree, and how it reads Nest's path, query and body dialects.

## Contents

- [Where the platform adapters disagree](#where-the-platform-adapters-disagree)
- [Routes](#routes)
- [Query strings](#query-strings)
- [Request bodies](#request-bodies)
- [Responses](#responses)

## Where the platform adapters disagree

Where `platform-express` and `platform-fastify` answer the same
situation differently, this adapter answers as
`platform-fastify` does. That is the closer of the two in every
case that matters here: the router scores its routes rather than
matching them in registration order, the response is
encapsulated behind an object with an escape hatch to the
socket, a trailing slash is significant, a body limit is a
megabyte, and there is no `X-Powered-By` or `ETag` on the way
out.

Two defaults follow the **Express 4** behaviour instead, on
purpose: `@Query()` and a URL-encoded body are parsed with the
`qs` grammar, and an empty JSON body reads as `{}`. Express 5
reads the query flat, as `platform-fastify` does, but bracket
syntax nests here, where a flat parser keeps `filter[name]` as a
literal key. A handler that reads those keys may need a change
when it moves to this adapter.

| Situation                                      | This adapter                                          | Express                                      | Fastify                    |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- | -------------------------- |
| A handler returns a string                     | `text/plain`                                          | `text/html`                                  | `text/plain`               |
| A handler returns raw bytes                    | `application/octet-stream`                            | serialised as JSON                           | `application/octet-stream` |
| `GET /users/` for `/users`                     | 404                                                   | matches                                      | 404                        |
| A redirect carries a body                      | no                                                    | yes                                          | no                         |
| Default body limit                             | 1 MiB                                                 | 100 KB                                       | 1 MiB                      |
| Empty JSON body                                | `{}`                                                  | `{}`                                         | 400                        |
| A body of JSON primitives                      | accepted                                              | 400                                          | accepted                   |
| `trustProxy: 1` (hops) / `['10.0.0.1']` (list) | supported, read as proxy-addr reads it                | through `trust proxy` settings               | supported                  |
| `req.params['*']` for `@Get('files/*')`        | the wildcard capture                                  | `req.params.rest` (array, path-to-regexp v8) | `req.params['*']`          |
| Middleware for every method                    | the path as a prefix, the way `router.use()` reads it | same                                         | same                       |

## Routes

Nest's path dialect is translated as the application starts:

| Nest              | Hono              |
| ----------------- | ----------------- |
| `/users/:id`      | `/users/:id`      |
| `/users/:id?`     | `/users/:id?`     |
| `/users{/:id}`    | `/users/:id?`     |
| `/users/:id(\d+)` | `/users/:id{\d+}` |
| `/files/*rest`    | `/files/*`        |

A path the router cannot read — `/users?`, a stray `}` or `(`,
or a group that holds more than one parameter — throws as the
application starts, rather than answering 404 later.

A wildcard is read back under `*`, the key Fastify answers it
by, and the name a route gave it is not carried over:
`@Get('files/*rest')` fills `req.params['*']` with
`reports/2024/q1.csv` for `/files/reports/2024/q1.csv`. Hono
matches a wildcard without reporting what it stood for, so the
adapter reads the capture out of the path itself.

Middleware mounted for every method — `app.use(fn)` and a
`MiddlewareConsumer` without a method — answers the path it was
given as a prefix, the way `router.use()` reads it on both
platform adapters: `use('/api')` answers `/api` and everything
under it. Middleware for one named method answers that path
alone, as a verb route reads it there.

Versioning works over URI, header, media type and the custom
strategy, including versioned redirects. A media-type version is
read out of `Accept` wherever it sits: `q` weights before it, or
an earlier media range, are skipped rather than mistaken for it.

## Query strings

`@Query()` receives the shape the platform parsers produce: a
repeated name becomes a list, `tags[]` appends, `tags[0]`
indexes and `filter[name]` nests. Values are percent-decoded,
`+` reads as a space, and `__proto__`, `constructor` and
`prototype` are dropped rather than written into the tree.

## Request bodies

The body is read when a handler reaches for it, not by
middleware:

- JSON, including the `+json` suffix types;
- URL-encoded and text bodies;
- `multipart/form-data`, through Hono's `parseBody()`; fields
  land on `NestRequest.body` and files on `NestRequest.files`;
- every other content type as a `Buffer`.

A body that does not match its content type is refused with
Nest's own `BadRequestException`, and one over `bodyLimit` with
`PayloadTooLargeException`, so both travel through the exception
layer and its filters.

`app.useBodyParser('json', { limit: '1kb' })` ignores the parser
name and sets one limit for the adapter, so the size applies to
every parser and every route, and it replaces the `bodyLimit`
option. Called without a `limit` it changes nothing.

With `rawBody: true` — the adapter option, or the same option on
`NestFactory.create` — `NestRequest.rawBody` holds the bytes
read, which is what a signed webhook needs. Multipart bodies
never fill it, because the platform parser consumes the stream.

## Responses

A returned value is answered as Nest answers it: an object as
JSON, a string as text, a number as text. Raw bytes — `Buffer`,
`Uint8Array`, `ArrayBuffer`, a `ReadableStream` — are answered
as `application/octet-stream`, the type Fastify labels them
with, because serialising them as JSON is the one answer that
loses them. `@Header()`, `@HttpCode()`, `@Redirect()` and
`StreamableFile` are all honoured, and a declared `Content-Type`
always wins over the inferred one.

`@Res()` works, and so does `@Res({ passthrough: true })`:
Hono's own response helpers (`json`, `text`, `html`, `body`,
`redirect`, `notFound`, `newResponse`) are the imperative API
here, and the adapter makes sure the response a handler builds
that way is the one that is sent. A `Response` assigned straight
to `context.res` is sent as well.

`write`, `setHeader`, `getHeaders` and the other Node stream
members are installed only once an `@Sse()` route opens its
stream, so a handler that reaches for one on an ordinary route
fails rather than writing.
