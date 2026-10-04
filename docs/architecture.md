# Architecture

Where a change is allowed to go, and what refuses it when it
does not. The shape of `src/` is enforced rather than described,
so this file explains the checks; where a sentence here and the
tree disagree, the tree is right.

## The layers

`src/` is three directories:

- `core/` holds the Nest to Hono contract: the request and
  response translation, the path dialect, versioning, and the
  server lifecycle.
- `features/` holds the capabilities a deployment turns on —
  CORS, event streams, static assets and views. Each is bound to
  the adapter from one place, and nowhere else.
- the four `ws-*` files at the root, with `ws.ts` beside them,
  are an island behind the `./ws` subpath.

The split buys one concrete thing: an application that serves
HTTP never resolves the WebSocket peers. The rest of it is
ownership — `features/` is where a capability is optional,
`core/` is where the contract Nest reads lives.

Recompute the sizes with `ls src/core`, `ls src/features` and
`ls src/*.ts`. The test below names every module it needs to
find, so a rename fails there before it fails here.

## The import rules

`test/layers.test.ts` walks the relative imports of `src/` and
refuses four crossings. Its test names are the rule text:

- `core` does not import `features`, except from
  `src/core/hono-lifecycle.ts` and `src/core/server-adapter.ts`.
- `features` does not import `features`.
- `features` does not reach the `ws` island.
- `ws` imports nothing from `core` or `features` as a value. A
  type-only import is erased by the compiler, so it is allowed.
  There is exactly one, and the test names it.

The two composition roots are the load-bearing part of the first
rule, and they are structural rather than a list someone wrote
down: `hono-lifecycle.ts` is where CORS is mounted in front of
every request, `server-adapter.ts` is where the optional
capabilities are bound to the adapter, and those two are the
only places the layers meet at all. A third core module naming a
feature would be a module that composes instead of translating,
and the exception would stop meaning anything.

What the test names beyond that is a list someone wrote down on
purpose. The modules a walk has to find are named so a rename
fails loudly instead of passing vacuously, and the lint
overrides are named in `.oxlintrc.json` with a reason each;
`docs/lint-exceptions.md` holds those.

Run it with `bun test test/layers.test.ts`.

## The entry points

`package.json` exports exactly two, `.` and `./ws`. Nothing else
is reachable to a consumer, which is why moving a module between
`core/` and `features/` is not a breaking change and the two
published surfaces are the whole promise.

The split is what keeps an HTTP-only deployment free of the
optional peers: `test/entry-points.test.ts` walks the graph from
each entry point and fails when the HTTP one reaches
`@nestjs/websockets`, `@hono/node-ws` or `ws`. A re-export from
`index.ts` would not do it, and `src/ws.ts` says why: an ESM
re-export resolves eagerly and would load them anyway.

## The Node boundary

`src/` is not runtime-neutral and does not pretend to be. It
imports eight `node:` builtins — `buffer`, `events`, `http`,
`https`, `fs/promises`, `path`, `stream` and `util` — which is
what `examples/cloudflare-workers/` sets
`enable_nodejs_http_server_modules` for: with that flag the
Workers runtime resolves them, and the example serves a real
Nest application there.

Recompute the list:

```sh
grep -rho "from 'node:[^']*'" src/ | sort -u
```

## The error contract

Two families, and which one a refusal belongs to is the part
worth knowing.

Refused while the application is being built, so a deployment
can still change its mind. Each throws a `TypeError`:

- a path the router cannot read (`src/core/path.ts`);
- a `bodyLimit` that is not a size (`src/core/body.ts`);
- a route or middleware Nest registered in a shape the router
  cannot read (`src/core/route-adapter.ts`);
- a static asset option Hono's own handler decides for itself,
  refused before anything is mounted
  (`src/features/static-assets.ts`);
- a view engine named before one was configured
  (`src/features/views.ts`);
- a gateway that asks for its own port, or for a namespace
  (`src/ws-adapter.ts`).

Answered by the exception layer instead, because a request
cannot be un-sent. Nest installs its handler through
`setErrorHandler`, so each of these travels it like any other
failure and the filters and interceptors see them:

- a body over the limit, or one that does not match its content
  type: `PayloadTooLargeException` and `BadRequestException`
  (`src/core/body.ts`);
- a view that is not there: `NotFoundException`
  (`src/features/views.ts`);
- a CORS `optionsSuccessStatus` the adapter does not send, and
  which it therefore cannot honour: a `TypeError` raised while
  the preflight is being answered
  (`src/features/cors-middleware.ts`).

## The byte ceilings

`.size-limit.json` carries a brotli ceiling per published entry
point, and `bun run size` is what measures them. It is a gate
rather than a report: CI fails when a ceiling is exceeded, so a
bundle that grows has to be argued for.

`ws` carries no headroom at all.

`index` carries an envelope rather than a margin. The feature
series is buying capability with bytes — a wildcard that
resolves, middleware that reaches the paths under it, an
`Accept` header read by parameter name rather than by position —
and 7800 B is what that series is allowed to spend, declared
once so each change reports its cost against a number instead of
against the last one. It is not a ratchet: inside the series the
ceiling does not move, and a change that would cross it is the
discussion rather than the budget. Issue #46 carries the review
that decides what the number is once the series closes.

The numbers move with every dependency bump, so read them from
the measurement and not from here. What is worth knowing is what
the measurement covers: the two published entry points, bundled
the way a consumer resolves them, with the peers and the Node
builtins excluded, because those bytes belong to the deployment
and not to this package.
