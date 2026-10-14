# Compatibility

What this adapter does about the code Nest users write against Express and Fastify, where it lives, and what it costs.

[architecture.md](architecture.md) says where the region sits in the tree; this page says what is in it and why it is shaped the way it is.

## The region

`packages/core/src/compat/` is a region of the adapter, a peer of `core/`, `features/` and `servers/`. It holds every shim whose only reason to exist is that the code it serves was written for another Nest platform.

```
compat/
  types.ts           the Bridge port: a name and one install
  registry/          the store, the discovery, the settle
  peer-load.ts       loading an optional peer as the app did
  peer-resolution.ts what a specifier resolves to, in what order
  express/           the Express surface and error middleware
```

Only `express` is here, and it has to be: an Express-shaped response call and an Express-shaped error middleware are part of running a Nest application, not an optional capability like uploads or websockets, so they stay on the `.` entrypoint and every deployment gets them without installing anything.

A bridge that belongs to a platform Nest users write against lives in the package for that platform, and the region is what finds it:

```
packages/serve-static/   @nestjs/serve-static, reading through the transport
packages/graphql/        the stock @nestjs/apollo driver answering on Hono
```

Neither is named in an application's code. Installing the package is what installs the bridge — see [Discovery](#discovery).

## What a bridge is

```ts
interface Bridge {
  readonly name: string;
  readonly install: (target: BridgeTarget) => void | Promise<void>;
}
```

A bridge is a named install. It runs once per Hono application, which is what lets an install patch a prototype: the second adapter in a process finds the application already fitted and does nothing.

`BridgeTarget` is the Hono application and its transport. That is the whole of what a bridge is handed, and it is enough, because every transport reads files through `serveStatic` and nothing else. A bridge that wanted a filesystem would have to be told where to find one, which is the trap `serve-static/` used to be in.

## Discovery

A bridge package is **not** imported by the application. A Nest application is not told which of its own dependencies speak a platform it has never run on; installing a package is what installs the bridge.

So the region resolves them. `compat/registry/discover.ts` carries the list, and each application start asks the application's own tree for each one:

```ts
const BRIDGE_PACKAGES = [
  '@ailura/nestjs-platform-hono-graphql',
  '@ailura/nestjs-platform-hono-serve-static',
];
```

A package that is installed evaluates and publishes its bridge; one that is not resolves to nothing and is skipped. The resolution is **the application's**, not the adapter's — `peer-load.ts` looks the specifier up where the application was started, because a bridge patches a prototype and has to hold the very class the application holds. `import.meta.resolve` is asked before the CommonJS resolver, since for a package that ships two builds a `require` condition names the CommonJS one and importing it from ESM loads a _second_ copy of every class in it.

The contract a bridge package publishes is one name:

```ts
export const bridge: Bridge = { name, install };
```

It does nothing on import, so `sideEffects: false` is honest and an import of it for its types alone costs nothing.

Discovery is settled by `init()` like an install is, because the bridges it turns up have to be installed before Nest calls `onModuleInit` — which is when `@nestjs/graphql` starts the driver the bridge has to have patched by then.

## The three bridges

One ships with the adapter and two ship with a package the adapter looks for. All three are described below.

### `express`

Two shims, both aimed at Nest's own Express-shaped code.

`app.use(async (err, req, res, next) => …)` is wrapped so Hono calls it with the four arguments it declares. `nestjs-i18n` mounts exactly that shape; Hono would otherwise call such a handler as `(context, next)`, and its own `next` would be undefined. A handler with fewer than four declared parameters is Hono's own middleware and is passed straight through.

`res.send()`, `res.json()` and `res.type()` are fitted onto Hono's context prototype, for a handler holding `@Res()` and answering the way its author wrote. A string body is labelled `text/html`, as Express labels it, unless the handler declared a content type itself.

#### Why a step never returns `next()`

Hono's `Next` is declared `() => Promise<void>`, but `compose()` ends with `return context` and `dispatch()` then writes whatever a middleware returned onto `context.res` while the context is unfinalized. `next()` therefore resolves to the **context**, and a step that returned it left the answer as the context itself: every later `context.res.headers` read threw, and the request failed as a `500`. Both front steps answer through `passed()`, which keeps a continuation's value only when it is a `Response`.

A Nest middleware may also call `next()` **without awaiting it** — `nestjs-i18n`'s does, and Nest's contract allows it. It hands the continuation to something it never waits for — its own wrapper runs `middleware.use(req, res, noop)` and answers with a bare `next(err)` — so the route runs on its own and Hono finishes the chain with the context unfinalized. `forwardFrom()` remembers the continuation and both bridges — the route bridge and the Express error bridge — await it before handing the chain back.

#### Which status the answer carries

Nest records a status against every `@Res()` response _before_ the handler runs, so "did Nest record a status" is the wrong question. The question is whether the handler moved it:

| What the handler did             | What carries            |
| -------------------------------- | ----------------------- |
| `res.send(body)`                 | `@HttpCode()`, else 200 |
| `res.status(201).send(body)`     | 201                     |
| `@HttpCode(202)` + `res.send(b)` | 202                     |

The one case this cannot separate is a handler that calls `res.status(200)` on a route declared with `@HttpCode()`: there the declared status wins. Hono keeps the status it was handed in a private field the adapter cannot read, so the shim lets Hono build the answer and reads the status back off the result rather than tracking `res.status()` itself — which is also why this costs nothing per request.

### `serve-static`

Shipped as `@ailura/nestjs-platform-hono-serve-static`, which peers on `@nestjs/serve-static`. That module builds an Express router and mounts it on the adapter's HTTP server, reading files through `express.static` and `res.sendFile`. On Hono that cannot work, so the bridge swaps its loader for one that:

- serves each directory through `transport.serveStatic()`, and
- answers the SPA fallback with one Hono middleware that reads the index file **through the transport** and turns a miss into the same `NotFoundException` the Express loader raises.

The swap is a patch of a third-party prototype, so it happens once per process and only when the peer is installed. It happens **before** the module's own `onModuleInit` runs, not after: that hook is what asks the loader to register, so a loader replaced once it has run is one nothing ever called.

`setHeaders` is refused rather than faked. It wants an `fs.Stats` and an Express response, and no transport here builds either; a deployment that names it gets a `TypeError` that says so.

### `graphql/apollo`

`@nestjs/graphql` is not bound to Express or Fastify. Its _drivers_ are, because each one only knows the server its own engine was built for, and both refuse anything else by name:

```js
// @nestjs/apollo — ApolloDriver.registerServer
if (platformName === 'express') { … }
else if (platformName === 'fastify') { … }
else {
  throw new Error(`No support for current HttpAdapter: ${platformName}`);
}
```

`MercuriusDriver.start` refuses the same way. So the bridge has no engine of its own to ship and no new class to name: it replaces that one branch on `ApolloDriver.prototype`, and the **stock driver** a deployment already names does the rest.

```ts
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';

GraphQLModule.forRoot({
  driver: ApolloDriver, // the one Nest publishes
  typeDefs: `type Query { hello: String }`,
  resolvers: { Query: { hello: () => 'world' } },
});
```

There is nothing to install and nothing to configure. An application running on Express or Fastify alongside it is untouched, because every other platform falls through to the driver's own branch.

What replaces `registerExpress` is the three things it does that Hono cannot use:

| `ApolloBaseDriver.registerExpress`     | On Hono                                 |
| -------------------------------------- | --------------------------------------- |
| `httpAdapter.use(path, bodyGuard)`     | the adapter's own body reader           |
| `expressMiddleware(server, {context})` | a Hono handler built here               |
| `app.use(path, middleware)`            | `registerGraphQLRoute`, the shared seam |

Two details the bridge had to get right, both of them the integration's behaviour rather than Hono's:

- **`context` belongs to the integration, not the engine.** `@as-integrations/express5` calls it as `context({ req, res })` and hands the resolver whatever it returns. So the bridge calls it the same way, with `req` being the adapter's own request object — so a factory written for Apollo on Express reads the members it always did — and `res` being the Hono context. With no factory named, the base context carries `c`, `ctx` and `req`, so a resolver still has the request.
- **`headers` is a real `Headers`.** The engine negotiates the answer's content type off it and reads it again when it reports a failure, so a plain object answers nothing at all.

A streaming answer is pulled a chunk at a time through a `ReadableStream`, so an incremental delivery starts before the operation does.

Subscriptions are not covered. `ApolloDriver.start` opens a `GqlSubscriptionService` on the adapter's HTTP server, which on a transport that serves no socket is nothing to attach to; that needs the WebSocket island and is its work, not this bridge's.

### The seam both drivers share

`packages/graphql/src/route.ts` holds `registerGraphQLRoute(hono, route)` — the whole of what a GraphQL driver needs from the adapter. It sits beside the drivers rather than inside either, because the Mercurius bridge mounts through the same seam with the same signature: a driver translates its own engine's request and response and hands the result over.

### Mercurius

`MercuriusDriver` is harder and is not covered yet. Mercurius is itself a Fastify plugin — `app.register(mercurius, options)` — so adapting it means giving Mercurius a Fastify-shaped object over the Hono application: `register`, `route`, `addHook`, `reply`, decorators. That façade is the same shape as `expressRequest`/`expressResponse` in this region, but a far larger surface, and it cannot be written honestly without `@nestjs/mercurius` installed to test against.

What exists is the seam and the context naming (`c`, `ctx`, `req`), which is what a Mercurius-written `context` factory reads.

## Why `init()` exists

The `serve-static` bridge has to resolve two optional peers before it can patch anything. That work cannot happen while the module graph is being evaluated, because a top-level `await` puts an async edge in front of every import of the `.` entrypoint and pays for two peer lookups on a deployment that serves no files.

It happens in the bridge's `install()`, which returns a promise. `ServerAdapter` awaits `settleBridges()` from `init()` — the hook Nest awaits at `nest-application.js` line 121, before `callInitHook()` at line 126. That window is exactly the one a bridge patching a third-party prototype needs: the patch is in place before `ServeStaticModule.onModuleInit` runs.

A bridge with nothing to resolve installs synchronously in the constructor, and `init()` is then an already-settled await.

## Extending it

`registerBridge` is published from the `.` entrypoint. An island registers its bridge at import time and the next adapter installs it alongside the shipped ones:

```ts
import { registerBridge } from '@ailura/nestjs-hono-adapter';

registerBridge({
  name: 'my-library',
  install: ({ hono, transport }) => {
    /* patch what the library needs */
  },
});
```

Registering the bridge that is already registered is a no-op; registering a _different_ one under a taken name is refused with a warning, so an island and the adapter cannot disagree about what `serve-static` means. An install that throws is logged and skipped rather than taking the application down with it.

`bridgeNames()` reports what is registered, which is what a deployment reaches for when a bridge is not behaving.

A bridge **package** gets the same treatment without the import: publish `bridge` and add the package's name to `BRIDGE_PACKAGES`, and the region installs it.

## What it costs

Nothing per request.

- The registry installs per Hono application, at construction. A deployment that builds one adapter pays it once.
- Discovery runs once per process: the specifiers are resolved and imported the first time an application starts, and every later start reads what that found. Registering runs each time and is idempotent, so a registry emptied by a test is filled again by the next application.
- The `express` surface fit is keyed on Hono's context prototype. The request path calls `installSurface(context)`, and after the first request that call is one `Reflect.getPrototypeOf` and one `WeakSet` hit — strictly cheaper than the `'send' in prototype` guard it replaced, which walked the prototype chain. `res.send()` builds through Hono's own writer, the one the Nest path already uses, so the shim adds no second encoding step.
- Each bridge package resolves its peers once, from `init()`, not from module evaluation.
- No bridge installs a middleware on the Hono chain. The bridges either patch a prototype once or hand the transport a handler; none adds a hop to a request.

The measured bundles are in [bundle-baseline.md](bundle-baseline.md).

## What is refused, and why

`setHeaders` on a `ServeStaticModule` registration is refused, with the same message `features/static-assets/options/assert.ts` uses. The hook is handed an `fs.Stats` and an Express response; a transport that reads files its own way — `Bun.file`, `@hono/node-server`, or whatever a fetch host wired in — has no such pair to build.

`serve-static/` used to fake it: a three-member object standing in for the response, and a real `node:fs/promises` `stat`. That is the half of the hook that only works on Node, and it is why the region now refuses the hook instead of honouring it on one runtime and ignoring it on the others.

The GraphQL bridge adds **no** drain plugin either. `@as-integrations/express5` registers one over `getHttpServer()`, which is right there because the Express adapter does not close the server itself. This one does, and a runtime whose `close()` does not call back on a server that was never listening turns a graceful drain into a shutdown that never ends.

## Where the other platform names still appear

The region holds the **bridges**: runtime shims that add or reshape behaviour. It does not hold the **call shapes**: the argument forms a feature accepts.

Those stay with their feature, because the dependency runs the other way. `features/static-assets/mount/target.ts` reads Express's `useStaticAssets(path, options)` and Fastify's `useStaticAssets({ root })` because that is the feature's own option parsing; moving it to `compat/` would make a feature reach into the region, which is the direction rule 6 forbids. `features/views/types.ts` keeps `ViewEngineOptions` for the same reason.

`core/server/socket.ts` stays in `core/` too. It fills `setKeepAlive`, `setNoDelay` and `setTimeout` onto a socket so the `Socket` port reads as a Node socket — that is the port's own contract, not a bridge to another platform.

## The guard

`test/layers.test.ts` holds rule 6: `core/` reaches `compat/` only from the two composition roots and through the one request seam that fits the Express surface. It holds a seventh rule too: a bridge **package** reaches the adapter only through the published entrypoint. Every name a bridge needs — `Bridge`, `BridgeTarget`, `NestContext`, `Transport`, `loadPeer`, `toHonoPath`, `toNestRequest` — is exported there, so a `#adapter/` import would be the same bridge reaching past the door into the tree behind it.

`test/node-builtins.test.ts` holds that no bridge names a Node builtin, and that none of them reaches a filesystem API. It walks all three trees: the region, and both bridge packages.

`packages/<bridge>/test/` holds that the package answers on its own — that the stock `@nestjs/apollo` driver queries on Hono with no import in the application, and that `@nestjs/serve-static` serves a file through the transport.
