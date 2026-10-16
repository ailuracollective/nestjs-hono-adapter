# Examples

Nine independent projects, one per transport and host:

| Folder                               | Transport | Entry          | Host                                     |
| ------------------------------------ | --------- | -------------- | ---------------------------------------- |
| `packages/examples/cloudflare/fetch` | fetch     | `src/worker.ts` | Cloudflare Workers                       |
| `packages/examples/cloudflare/node`  | node      | `src/worker.ts` | Cloudflare Workers, on `cloudflare:node`  |
| `packages/examples/deno/fetch`       | fetch     | `src/main.ts`  | Deno, through the fetch handler            |
| `packages/examples/deno/node`        | node      | `src/main.ts`  | Deno, through a Node server                 |
| `packages/examples/vercel/fetch`     | fetch     | `src/server.ts` | Vercel, through the fetch export          |
| `packages/examples/vercel/node`      | node      | `src/server.ts` | Vercel, through a captured Node server    |
| `packages/examples/vercel/bun`       | bun       | `src/server.ts` | Vercel's Bun runtime                      |
| `packages/examples/google/fetch`     | fetch     | `src/index.ts`  | Cloud Functions, through the Functions Framework |
| `packages/examples/google/node`      | node      | `src/server.ts` | Cloud Run, a Node container              |

Every example carries `enableVersioning({ type: URI, defaultVersion: '1' })`,
so every route sits under `/v1` unless it says otherwise:

| Route              | Answer                                       |
| ------------------ | -------------------------------------------- |
| `GET /v1/health`   | `{ ok: true, where: 'workers' | 'vercel' | 'docker' | 'google' }`  |
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
does not let a client set — is the address. The Docker one trusts
nothing either — the image publishes its own port — so it reports the
socket address too, and `trustProxy: true` is what hands it a client
behind an ingress.
Both Google ones read the last entry of `x-forwarded-for`
(`trustProxy: 1`), the client Google's front end appended: the first
entry is whatever the caller sent, so trusting it lets a client name
any address it likes.
The Cloudflare node
example also adds `GET /v1/debug-env`, which reports that request
binding.

## Run it

```sh
bun install
bun run --cwd packages/examples/cloudflare/fetch dev
```

Swap `fetch` for `node`, or for `vercel/fetch`, `vercel/node`,
`vercel/bun`, `docker/bun` or `google/fetch` and `google/node`, for the
others. The transports that
listen run on Bun alone, without the Vercel CLI or an image:

```sh
bun run packages/examples/vercel/node/src/server.ts
bun run packages/examples/vercel/bun/src/standalone.ts
bun run packages/examples/docker/bun/src/server.ts
deno run --allow-net --allow-env packages/examples/deno/fetch/src/main.ts
deno run --allow-net --allow-env packages/examples/deno/node/src/main.ts
```

## Deno

Deno uses its own module resolution (`nodeModulesDir: "manual"`), so each
folder declares its dependencies in `package.json` and imports the adapter
through the workspace's hoisted `node_modules`. The host hands no port to
the fetch transport, while the node transport opens its own server:

```sh
deno run --allow-net --allow-env packages/examples/deno/fetch/src/main.ts
deno run --allow-net --allow-env packages/examples/deno/node/src/main.ts
```

Both examples set `trustProxy: false`; the fetch one reads `info.remoteAddr`
from `Deno.serve`, and the node one reads the socket address through the
Node compatibility layer.

The adapter arrives through the hoisted workspace, so a clean checkout needs
`bun run build:core` first, the way the Vercel folders need it.

`where` on `GET /v1/health` is `deno` in both folders.

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

## Google Cloud Functions

Cloud Functions has no Bun runtime: a function is built by Google's
buildpacks from a `--runtime` in its list and takes no container image,
so Bun on Google Cloud means Cloud Run — the Docker example above
covers it. This folder is the Node runtime, and it keeps the fetch
transport: the Functions Framework hands a function a Node request and
response, so `src/index.ts` hands `fetchHandler()` to
`getRequestListener()` from `@hono/node-server`, which turns that Node
pair into the Web `Request` the adapter reads and back into the Node
response.

That conversion is one line because the framework's own body parsing is
the case `getRequestListener()` already handles. `body-parser` runs
before the function and keeps the bytes in `req.rawBody`, so the request
stream is drained by the time the listener reads it; the listener
rebuilds the body from `incoming.rawBody` when it is there, drops the
hop-by-hop headers and the `content-length` the body recomputes, and
writes the Web `Response` back through the Node one.

The runtime executes a bundle, not the sources: `bun run bundle` is
`bun build --target=node`, with the five optional peers
`@nestjs/microservices` reaches through `import()` left external. It
writes `dist/index.mjs` and copies `deploy.package.json` beside it as
`dist/package.json`, whose `main` names the bundle: the Functions
Framework resolves the entry with `require.resolve` on the directory it
is given, and a folder without that `main` fails to load.

`--source=dist` uploads that folder alone, and the upload is what makes
the build work at all: Google's Node buildpack runs its own `npm
install` over the sources, and the example's own `package.json` depends
on the adapter as `workspace:*`, which npm cannot install. The uploaded
`package.json` declares no dependencies — the bundle already carries
Nest, Hono and the adapter — so the build only adds the Functions
Framework the runtime starts. Pointing `--source` at the folder instead
still works: the `.gcloudignore` here is what stops gcloud deriving the
upload list from `.gitignore` and dropping the git-ignored `dist/`.

| Setting     | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| Runtime     | `nodejs22`, the Node line this repository develops against  |
| Entry point | `handler`, the export `src/index.ts` carries                 |
| Trigger     | HTTP, `--gen2`, unauthenticated                              |
| Source      | `dist/`: the bundle and its `package.json`                    |

```sh
bun run --cwd packages/examples/google/fetch dev     # Functions Framework on :8080
bun run --cwd packages/examples/google/fetch deploy  # bundle, then gcloud functions deploy
```

`dev` builds the bundle and serves it with the Functions Framework on
port 8080, which is what Cloud Functions runs itself; the export and the
`--entry-point` are the same name and move together. The deployed URL
answers the routes above under `/v1`.

On a fresh project `--allow-unauthenticated` alone can leave the gen2
function private: its underlying Cloud Run service is what refuses the
call, so `gcloud run services add-iam-policy-binding <name> --region
<region> --member=allUsers --role=roles/run.invoker` — or `gcloud
functions add-invoker-policy-binding` — is what opens it.

## Google Cloud Run

Cloud Run runs a container that owns its own HTTP loop, which is what
`nodeServer()` serves through, so this folder is the same application
on the Node transport with no bridge at all: `src/server.ts` names
`nodeServer()` and ends in `app.listen(PORT)`, and the host is the
only thing the Cloud Functions folder does differently.

The image is built from the repository root, like the Docker one and
for the same reason — the adapter comes from the workspace:

```sh
docker build -t ailura-hono-google-node -f packages/examples/google/node/Dockerfile .
docker run --rm -p 8080:8080 ailura-hono-google-node
curl localhost:8080/v1/health
```

`bun run docker:build` and `bun run docker:run` do the same from the
folder. The build stage installs the workspace from the lockfile and
bundles with `bun build --target=node`; the second stage copies that
bundle alone onto `node:22-slim`, so the image carries Node and the
bundle, and nothing else from the repository.

| Setting | Value                                                           |
| ------- | --------------------------------------------------------------- |
| Runtime | Node, `node:22-slim`, the line this repository develops against |
| Port    | `$PORT`, 8080 by default and the port Cloud Run injects         |
| Trigger | HTTP, unauthenticated (`--allow-unauthenticated`)               |

Cloud Run takes the port from the container, and the container takes it
from `$PORT`. `gcloud run deploy --source` builds the image in the
cloud, which is the route a machine without Docker can take, and it
looks for the Dockerfile at the source root — so the Dockerfile moves
there for the build and the repository root, which the context has to
be, is what gets uploaded:

```sh
cp packages/examples/google/node/Dockerfile Dockerfile
gcloud run deploy ailura-nestjs-hono-google-node \
  --source . --region us-central1 --allow-unauthenticated
rm Dockerfile
```

Building the image here is the other route: `docker build -t
ailura-hono-google-node -f packages/examples/google/node/Dockerfile .`,
then `docker tag` and `docker push` against a repository the project
holds, then `--image` in place of `--source`.

Either route needs the default service account to be allowed to build:
in a fresh project `roles/cloudbuild.builds.builder` is not attached,
and the deploy stops before building with `the default service account
is missing required IAM permissions`. Grant it to the account the error
names — `gcloud projects add-iam-policy-binding <project>
--member=serviceAccount:<number>-compute@developer.gserviceaccount.com
--role=roles/cloudbuild.builds.builder`.

```sh
bun run --cwd packages/examples/google/node dev  # bundle, then Node on :8080
```

## Google from GitHub

Both folders carry a `cloudbuild.yaml` — `google/fetch/cloudbuild.yaml`
for the function, `google/node/cloudbuild.yaml` for the service — and one
Cloud Build trigger pointing at each deploys on every push. The steps are
the commands above: Bun installs and bundles, then `gcloud` deploys what
was bundled.

One piece is not in the repository: the connection between GitHub and the
project. It is authorized once, in a browser, against the GitHub app that Cloud
Build installs on the organisation, and every trigger in the project
reuses it.
Until it exists `gcloud builds triggers create` only answers
`INVALID_ARGUMENT`.

```sh
gcloud builds connections create github github --region us-central1
```

That command needs Secret Manager enabled and `roles/secretmanager.admin`
on `service-<number>@gcp-sa-cloudbuild.iam.gserviceaccount.com`, which is
where the OAuth token lands — without it it fails with `could not assert
Secret Manager permissions`. It prints a browser link; authorizing turns
the connection from `PENDING_USER_OAUTH` into `COMPLETE`, and the
repository is linked once:

```sh
gcloud builds repositories create nestjs-hono-adapter \
  --connection=github --region=us-central1 \
  --remote-uri=https://github.com/<owner>/<repo>.git
```

```sh
gcloud builds triggers create github --name=ailura-google-fetch \
  --branch-pattern='^main$' --region us-central1 \
  --build-config=packages/examples/google/fetch/cloudbuild.yaml \
  --service-account=projects/<project>/serviceAccounts/<number>-compute@developer.gserviceaccount.com \
  --repository=projects/<project>/locations/us-central1/connections/github/repositories/nestjs-hono-adapter

gcloud builds triggers create github --name=ailura-google-node \
  --branch-pattern='^main$' --region us-central1 \
  --build-config=packages/examples/google/node/cloudbuild.yaml \
  --service-account=projects/<project>/serviceAccounts/<number>-compute@developer.gserviceaccount.com \
  --repository=projects/<project>/locations/us-central1/connections/github/repositories/nestjs-hono-adapter
```

A trigger over a repository connection has to name its build service
account: without `--service-account` the API answers nothing more useful
than `Request contains an invalid argument`, whatever else the command
carries. It is the account the roles above belong to, and the one the
builds run as either way.

Neither build needs a `Dockerfile` at the repository root: the Cloud Run
one passes `-f packages/examples/google/node/Dockerfile` with the root as
its context. The image lands in the project's `cloud-run-source-deploy`
Artifact Registry repository, which `gcloud run deploy --source` creates
and a fresh project does not have — `gcloud artifacts repositories create
cloud-run-source-deploy --repository-format=docker --location <region>`.

The builds run as the project's default compute service account, so it
needs what a deploy needs: `roles/run.admin`,
`roles/cloudfunctions.developer`, `roles/iam.serviceAccountUser`,
`roles/artifactregistry.writer` and `roles/storage.objectAdmin`, with
`cloudresourcemanager.googleapis.com` enabled — without that API the
function step stops at `Cloud Resource Manager API has not been used`.
Both configs log to Cloud Logging alone, so the CLI prints nothing for a
build it did not start: `gcloud builds log <build-id> --region <region>`.

The same build runs by hand, with no trigger and no connection:

```sh
gcloud builds submit --config=packages/examples/google/fetch/cloudbuild.yaml .
gcloud builds submit --config=packages/examples/google/node/cloudbuild.yaml .
```
