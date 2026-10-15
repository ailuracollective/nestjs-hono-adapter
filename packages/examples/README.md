# Examples

Five independent projects, one per transport a host can run:

| Folder                               | Transport | Entry          | Host                                     |
| ------------------------------------ | --------- | -------------- | ---------------------------------------- |
| `packages/examples/cloudflare/fetch` | fetch     | `src/worker.ts` | Cloudflare Workers                       |
| `packages/examples/cloudflare/node`  | node      | `src/worker.ts` | Cloudflare Workers, on `cloudflare:node`  |
| `packages/examples/vercel/fetch`     | fetch     | `src/server.ts` | Vercel, through the fetch export          |
| `packages/examples/vercel/node`      | node      | `src/server.ts` | Vercel, through a captured Node server    |
| `packages/examples/vercel/bun`       | bun       | `src/server.ts` | Vercel's Bun runtime                      |

Every example carries `enableVersioning({ type: URI, defaultVersion: '1' })`,
so every route sits under `/v1` unless it says otherwise:

| Route              | Answer                                       |
| ------------------ | -------------------------------------------- |
| `GET /v1/health`   | `{ ok: true, where: 'workers' | 'vercel' }`  |
| `GET /v1/hello?name=` | `Hello <name>!`                         |
| `GET /v1/query?foo=bar` | `{ foo: 'bar' }`, all query parameters |
| `GET /v2/hello`    | `{ from: 'v2' }`, the versioned controller   |
| `POST /v1/echo`    | the body, echoed back                        |
| `POST /v1/raw`     | the byte count Nest kept, with `rawBody: true` |
| `GET /v1/stream`   | three SSE frames, 100 ms apart              |
| `GET /v1/boom`     | 418, answered by the filter                  |
| `GET /v1/private`  | 401 without the token                         |
| `GET /v1/whoami`   | the client address                            |
| `GET /v1/docs-json` | the OpenAPI document                        |
| `GET /v1/reference` | the Scalar API reference                    |

CORS is on for `https://example.com` and `bodyLimit` is 1 KiB, so
a larger body is refused with a 413:

```sh
curl -i -X OPTIONS localhost:8787/v1/hello \
  -H 'Origin: https://example.com' \
  -H 'Access-Control-Request-Method: GET'
```

Every example carries a guard on `GET /v1/private` needing
`x-api-token: let-me-in` (401 without it), and answers
`GET /v1/whoami` with the client address, which each host supplies
differently: the fetch Worker reads `cf-connecting-ip` and the node
one the `cloudflare:node` socket, both with `trustProxy` off; the
three Vercel ones trust the hop in front of them, so
`x-forwarded-for` — a header Vercel overwrites on every request and
does not let a client set — is the address. The Cloudflare node
example also adds `GET /v1/debug-env`, which reports that request
binding.

## Run it

```sh
bun install
bun run --cwd packages/examples/cloudflare/fetch dev
```

Swap `fetch` for `node`, or for `vercel/fetch`, `vercel/node` or
`vercel/bun`, for the others. The two transports that listen run on
Bun alone, without the Vercel CLI:

```sh
bun run packages/examples/vercel/node/src/server.ts
bun run packages/examples/vercel/bun/src/standalone.ts
```

## Cloudflare

Root directory is the example folder. Its `package.json` carries
the scripts:

| Setting                      | Value           |
| ---------------------------- | --------------- |
| Root directory               | `packages/examples/cloudflare/fetch` |
| Build command                | `bun install --frozen-lockfile` |
| Deploy command               | `bun run deploy` |
| Non-production branch deploy | `bun run preview` |

`preview` is `wrangler versions upload` with
`WRANGLER_CI_MATCH_TAG` unset, not `wrangler preview` — the
latter rejects this bundle. Workers Builds hands a branch build a
tag that belongs to no Worker, so wrangler's pre-upload identity
check refuses every upload with `The name in your wrangler.jsonc
file (...) must match the name of your Worker`. Dropping the
variable skips that check, the workaround in
[cloudflare/workers-sdk#15682](https://github.com/cloudflare/workers-sdk/issues/15682).
`env` is POSIX and the Workers Builds host is Linux.

From the repository root instead, name the config:

```sh
bunx wrangler deploy --config packages/examples/cloudflare/fetch/wrangler.jsonc
```

### The transport import

A project imports a published subpath:

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

new ServerAdapter({ transport: fetchServer() });
```

These folders import `.../servers/fetch` instead, which is **not**
in the package's `exports` map: `wrangler.jsonc` and
`tsconfig.json` alias it to `packages/core/src/servers/fetch.ts`,
so it resolves from a fresh clone with no build. Do not copy that
spelling.

### The client address

A fetch host has no socket, so `req.ip` is empty unless the host
names one; the fetch Worker passes a `clientAddress` resolver
reading `cf-connecting-ip`, which Cloudflare sets and strips from
clients. `trustProxy` stays off in both examples, so
`x-forwarded-for` cannot replace the host's address or the Node
socket address.

Both folders are Bun workspace members, so an install from
anywhere hoists `node_modules` to the root, where the
`packages/core/src/` imports resolve.

The thirteen optional peers Nest and `@nestjs/swagger` name inside
lazy `import()`s are aliased to `src/stub-optional-peers.ts`, an
empty module (see the comment there). The `node:module` specifier
is aliased to `src/stub-node-module.ts` in both folders:
`@nestjs/swagger` builds a `require` at module scope with
`createRequire(import.meta.url)`, and a bundled Worker leaves
`import.meta.url` undefined
([workerd#6986](https://github.com/cloudflare/workerd/issues/6986)),
so the call throws before the Worker boots. The shim defaults the
argument to a file URL. The `define` in `wrangler.jsonc` hides the
same thing for `wrangler deploy` and `wrangler versions upload`,
but `wrangler preview` ignores `define`, so the alias is what keeps
`npx wrangler preview` — the command Workers Builds resets preview
branches to — working.

### Constructor injection

`BoomFilter` takes a `HttpAdapterHost` and names it with
`@Inject`, rather than leaning on the constructor type. Wrangler
transpiles with esbuild, which does not emit `design:paramtypes`,
so without the decorator Nest builds the filter with nothing and
`catch` throws on the first request. Anything in these folders
with a constructor parameter needs the decorator.

### Why there is no Bun folder

`workerd` has no `Bun` global, so it cannot run `Bun.serve`, which
is what `bunServer()` serves through.

## Vercel

The three folders deploy the same application through the three
transports, each in the shape its runtime detects. Root directory is
the example folder, and the repository is checked out around it, so
the example reaches the adapter by name:

```ts
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

new ServerAdapter({ transport: fetchServer() });
```

That name resolves to `packages/core/dist`, which a clean checkout
does not carry, so every example runs the same `vercel-build`
script — `bun run --cwd ../../../.. build:core` — before Vercel
packages the Function. The workspace dependency is declared as
`workspace:*`, so an install anywhere in the repository links it.

| Setting        | Value                                  |
| -------------- | -------------------------------------- |
| Root directory | `packages/examples/vercel/fetch`        |
| Install        | auto-detected, from `bun.lock` at the repository root |
| Build          | `vercel-build`, run by the NestJS preset (`buildCommand` in `vercel.json` for `bun`, which the Bun preset does not run) |

Vercel detects `@nestjs/core` in the dependencies and reads the
NestJS entry `src/server.ts`, which imports it. That makes the whole
application **one** Function served at `/`: no `api/` directory and
no `vercel.json` rewriting is needed, and the runtime hands the
application the request's own path. What the entry does with the
transport is what differs:

| Folder  | Transport     | Vercel detects                                              |
| ------- | ------------- | ----------------------------------------------------------- |
| `fetch` | `fetchServer()` | `export default { fetch }`, the Web Request/Response export |
| `node`  | `nodeServer()`  | the `http.Server` `app.listen()` opens                        |
| `bun`   | `bunServer()`   | the `Bun.serve` `app.listen()` opens, inside the bundle the entry loads |

The port is `process.env.PORT ?? 3000`, and it is the port the
server listens on locally alone: `$PORT` is not a public port on
Vercel. The `bun` folder carries the `vercel.json` the Bun runtime
needs — `bunVersion`, set to the `1.4.x` line this repository
develops against — and the other two need none. `node` passes
`overrideGlobalObjects: false` to `nodeServer()`, leaving the
process's `Request` and `Response` to the host that owns them.

Vercel's edge overwrites `x-forwarded-for` and does not forward
external IPs, to prevent IP spoofing, so all three trust that one
hop (`trustProxy: true`) and `GET /v1/whoami` names the client.

Deploy from the repository root, linked to a project whose Root
Directory is the example folder — the CLI uploads the folder it is
linked in, so a deploy from the example folder alone carries
neither `bun.lock` nor the adapter it links:

```sh
bunx vercel link --project <project>
bunx vercel deploy --prod
```

### The Git flow

Every folder carries the same `vercel.json`, so a Git-connected
project builds exactly what a CLI deploy builds — the difference
between the three folders lives in their own `vercel-build` script,
and all three set the same `framework`, `installCommand` and
`buildCommand`:

| Field            | Value                           |
| ---------------- | ------------------------------- |
| `framework`      | `nestjs`                        |
| `installCommand` | `bun install --frozen-lockfile` |
| `buildCommand`   | `bun run vercel-build`          |
| `bunVersion`     | `1.4.x`, `bun` alone             |

`vercel.json` takes precedence over the dashboard, so importing the
repository once per folder — Root Directory `packages/examples/vercel/<name>`
— is the whole setup: Vercel then builds a preview for every pull
request and production for `main`, with no GitHub workflow. Two
project settings decide whether that works: **Include source files
outside of the Root Directory in the Build Step** is on by default and
the build needs it (`packages/core`, the root `bun.lock` and the
hoisted `node_modules` all live outside the Root Directory), while
**Skip deployment** in the Root Directory section must stay off,
because a change to `packages/core` affects all three examples and
Vercel cannot tell.

### The listen call

Vercel's Node handler replaces `http.Server.prototype.listen` for the
duration of the import, to capture the server `app.listen()` opens,
and puts the real method back before it listens on the port it
proxies to. The adapter therefore looks the method up on the
prototype on every call
(`packages/core/src/servers/node/listen.ts`): a reference bound when
the server is created calls the capture again, never binds, and
answers every route with `INTERNAL_FUNCTION_INVOCATION_FAILED`.

### The Bun runtime

The `bun` folder serves, but not in the shape the other two use.
Vercel traces a Function by walking the entry's module graph, so a
package that only the CommonJS files of a traced package require
never reaches the deployed tree: `@nestjs/common` and `@nestjs/core`
arrive, `tslib` — required by nearly every file of both — does not,
and `/var/task/node_modules/@nestjs/common/pipes/validation.pipe.js`
cannot import it, so every route answers 500
`FUNCTION_INVOCATION_FAILED`. Declaring `tslib` in this folder,
importing it from the entry, and deploying a build made here
(`vercel build`, then `vercel deploy --prebuilt`, whose file map
does list it) all leave the same gap, while the same application on
the Node runtime — the `fetch` and `node` folders — carries it: it
is the trace, not the transport (vercel/vercel#17354, vercel/vercel
#16361).

So this folder hands the Function a self-contained bundle. The
application lives in `src/standalone.ts`, the `bundle` script runs
`bun build src/standalone.ts --target=bun` with the five optional
Nest peers of `@nestjs/microservices` external — they sit behind
`import()` calls the application never reaches — and the entry,
`src/server.ts`, only does `import '../dist/standalone.mjs'`. The
folder's `vercel.json` is what makes that work: it names the same
`nestjs` preset as the other two folders, `bunVersion` puts the
Function on Bun — `Bun.serve` exists nowhere else — and
`buildCommand` builds the bundle before the Function is packaged.

The entry also names `@nestjs/core` in a type-only import, because
the Bun preset picks its root entrypoint by matching the file against
`(?:from|require|import)\s*['"]@nestjs/core['"]`; the import keeps
that gate satisfied whichever preset the project carries and
disappears before the Function runs. Run the folder locally from the
application itself:

```sh
bun run packages/examples/vercel/bun/src/standalone.ts
```
