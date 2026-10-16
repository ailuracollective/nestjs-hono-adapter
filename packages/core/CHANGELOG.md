# Changelog

## [2.0.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.0.0...v2.0.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* `@Query()` and URL-encoded bodies no longer parse with the `qs` grammar. `filter[name]` is now the literal key `filter[name]` instead of `{ filter: { name } }`, and a bracket suffix no longer builds a list or an object.
* a bootstrap that names no transport now serves through Bun's own server, so a deployment on Node names nodeServer()
    - one import, no other change. The shared overrideGlobalObjects
    option is gone with that default; the Node transport keeps its own.
    The conditional import gives the module a top-level await, so the
    package can no longer be loaded with require(). WebSockets on Node
    are unaffected: the Bun transport carries no helper there and the ws
    package falls back to @hono/node-ws, as before.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))
* add the compatibility bridge region and its first bridges ([71e7428](https://github.com/ailuracollective/nestjs-hono-adapter/commit/71e7428254481984a2920bf87c3c4fb434943b93))
* answer `request.raw` with nothing when no carrier arrived ([68212f9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/68212f9093759383a0994021f5bcabb51dde3e4d))
* **benchmarks:** add resource usage metrics and reporting to benchmark suite ([9a1fb17](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9a1fb172ae413e739fc187886325d45bf731847e))
* integrate [@socket](https://github.com/socket).io/bun-engine support and enhance Bun transport handling ([c43031b](https://github.com/ailuracollective/nestjs-hono-adapter/commit/c43031b5cd073132777d8c6542c5457b14d5aff8))
* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))
* read the query string and form bodies flat ([7c8c798](https://github.com/ailuracollective/nestjs-hono-adapter/commit/7c8c798190ebe80dbcbf35f0451154282d026b29))
* resolve a named view engine on first render ([3a5fef9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3a5fef92d2e4b51d9732d9e0f8fb283c734960f5))
* serve through Bun when no transport is named ([#172](https://github.com/ailuracollective/nestjs-hono-adapter/issues/172)) ([ac126d5](https://github.com/ailuracollective/nestjs-hono-adapter/commit/ac126d51fac8d29a51275c6a9225fe880e7752d5))
* update NestJS dependencies to support version ranges and enhance request body handling ([3430361](https://github.com/ailuracollective/nestjs-hono-adapter/commit/343036132095d55306b701d02b697903106022f8))


### Bug Fixes

* answer @Controller({ host }) routes instead of failing with a 500 ([#181](https://github.com/ailuracollective/nestjs-hono-adapter/issues/181)) ([a80f4a7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a80f4a7295431e3e914b385deaec720806c972c5))
* default the Node transport's overrideGlobalObjects to true ([#183](https://github.com/ailuracollective/nestjs-hono-adapter/issues/183)) ([6af686a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6af686a6cb0e4002b78f7bec59a09a7a3faa04fc))
* downgrade version of core package to 1.0.0 ([0f1e94d](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0f1e94db1d1617aba2802354364d900ac82aac85))
* downgrade version of core package to 2.0.0 ([32b5829](https://github.com/ailuracollective/nestjs-hono-adapter/commit/32b5829175d1ce9fa0fddc830be3fadc57bccdad))
* Express bridge and request path diverge from Express/Nest ([#193](https://github.com/ailuracollective/nestjs-hono-adapter/issues/193)) ([f8a3658](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f8a3658ad506dcfa7c19bec96250eb53f6ce352f))
* Express middleware surface, streamed bodies, and urlencoded GraphQL ([#191](https://github.com/ailuracollective/nestjs-hono-adapter/issues/191)) ([3565eb4](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3565eb4b52af914e0d48bcfc7e467fda2978398f))
* hand Hono an environment when a request is injected ([9c3e865](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9c3e86525d411aaad4e8a5842410cbe7403ec3ae))
* hold every bridged continuation open ([0717631](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0717631e2bda58dddef87bf47508880ccaf61d0e))
* keep a write to a get-only member such as res.req ([#199](https://github.com/ailuracollective/nestjs-hono-adapter/issues/199)) ([0c67145](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0c67145f342013c7ce5636edc0426ea8ff6627b1))
* keep the request's body, bag and params across bridges ([d16f6f9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/d16f6f9e186851c4329faf5a1b70613d20cfb2cd))
* **multipart:** mark the island across duplicated core copies ([3488b19](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3488b19045f3b8a8cd64e72357ad61cecb39c38c))
* refuse TLS options Bun cannot read instead of serving in the clear ([#197](https://github.com/ailuracollective/nestjs-hono-adapter/issues/197)) ([8048a64](https://github.com/ailuracollective/nestjs-hono-adapter/commit/8048a64e5753a5e7357b74e58f9d3d2a974ca7bb))
* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* send no security headers unless secureHeaders asks for them ([#182](https://github.com/ailuracollective/nestjs-hono-adapter/issues/182)) ([b42f037](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b42f037013ee2c6542478f652ac37fa70889c9e0))
* stream a StreamableFile across duplicated copies ([5a4ccd3](https://github.com/ailuracollective/nestjs-hono-adapter/commit/5a4ccd3b70045b808ac4be8b1cd8d9e6b0112a4f))
* update package versions and enhance documentation for clarity ([b158eda](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b158eda2aac536d54e27f4310b53d1d7130f89c8))
* update package versions to remove beta tags and set to stable releases ([af9aa58](https://github.com/ailuracollective/nestjs-hono-adapter/commit/af9aa58a067dbf637ede8805ac301edeea08e8db))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))

## [3.0.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v2.0.0...v3.0.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* `@Query()` and URL-encoded bodies no longer parse with the `qs` grammar. `filter[name]` is now the literal key `filter[name]` instead of `{ filter: { name } }`, and a bracket suffix no longer builds a list or an object.
* a bootstrap that names no transport now serves through Bun's own server, so a deployment on Node names nodeServer()
    - one import, no other change. The shared overrideGlobalObjects
    option is gone with that default; the Node transport keeps its own.
    The conditional import gives the module a top-level await, so the
    package can no longer be loaded with require(). WebSockets on Node
    are unaffected: the Bun transport carries no helper there and the ws
    package falls back to @hono/node-ws, as before.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))
* add the compatibility bridge region and its first bridges ([71e7428](https://github.com/ailuracollective/nestjs-hono-adapter/commit/71e7428254481984a2920bf87c3c4fb434943b93))
* answer `request.raw` with nothing when no carrier arrived ([68212f9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/68212f9093759383a0994021f5bcabb51dde3e4d))
* **benchmarks:** add resource usage metrics and reporting to benchmark suite ([9a1fb17](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9a1fb172ae413e739fc187886325d45bf731847e))
* integrate [@socket](https://github.com/socket).io/bun-engine support and enhance Bun transport handling ([c43031b](https://github.com/ailuracollective/nestjs-hono-adapter/commit/c43031b5cd073132777d8c6542c5457b14d5aff8))
* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))
* read the query string and form bodies flat ([7c8c798](https://github.com/ailuracollective/nestjs-hono-adapter/commit/7c8c798190ebe80dbcbf35f0451154282d026b29))
* resolve a named view engine on first render ([3a5fef9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3a5fef92d2e4b51d9732d9e0f8fb283c734960f5))
* serve through Bun when no transport is named ([#172](https://github.com/ailuracollective/nestjs-hono-adapter/issues/172)) ([ac126d5](https://github.com/ailuracollective/nestjs-hono-adapter/commit/ac126d51fac8d29a51275c6a9225fe880e7752d5))
* update NestJS dependencies to support version ranges and enhance request body handling ([3430361](https://github.com/ailuracollective/nestjs-hono-adapter/commit/343036132095d55306b701d02b697903106022f8))


### Bug Fixes

* answer @Controller({ host }) routes instead of failing with a 500 ([#181](https://github.com/ailuracollective/nestjs-hono-adapter/issues/181)) ([a80f4a7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a80f4a7295431e3e914b385deaec720806c972c5))
* default the Node transport's overrideGlobalObjects to true ([#183](https://github.com/ailuracollective/nestjs-hono-adapter/issues/183)) ([6af686a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6af686a6cb0e4002b78f7bec59a09a7a3faa04fc))
* Express bridge and request path diverge from Express/Nest ([#193](https://github.com/ailuracollective/nestjs-hono-adapter/issues/193)) ([f8a3658](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f8a3658ad506dcfa7c19bec96250eb53f6ce352f))
* Express middleware surface, streamed bodies, and urlencoded GraphQL ([#191](https://github.com/ailuracollective/nestjs-hono-adapter/issues/191)) ([3565eb4](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3565eb4b52af914e0d48bcfc7e467fda2978398f))
* hand Hono an environment when a request is injected ([9c3e865](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9c3e86525d411aaad4e8a5842410cbe7403ec3ae))
* hold every bridged continuation open ([0717631](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0717631e2bda58dddef87bf47508880ccaf61d0e))
* keep a write to a get-only member such as res.req ([#199](https://github.com/ailuracollective/nestjs-hono-adapter/issues/199)) ([0c67145](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0c67145f342013c7ce5636edc0426ea8ff6627b1))
* keep the request's body, bag and params across bridges ([d16f6f9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/d16f6f9e186851c4329faf5a1b70613d20cfb2cd))
* **multipart:** mark the island across duplicated core copies ([3488b19](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3488b19045f3b8a8cd64e72357ad61cecb39c38c))
* refuse TLS options Bun cannot read instead of serving in the clear ([#197](https://github.com/ailuracollective/nestjs-hono-adapter/issues/197)) ([8048a64](https://github.com/ailuracollective/nestjs-hono-adapter/commit/8048a64e5753a5e7357b74e58f9d3d2a974ca7bb))
* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* send no security headers unless secureHeaders asks for them ([#182](https://github.com/ailuracollective/nestjs-hono-adapter/issues/182)) ([b42f037](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b42f037013ee2c6542478f652ac37fa70889c9e0))
* stream a StreamableFile across duplicated copies ([5a4ccd3](https://github.com/ailuracollective/nestjs-hono-adapter/commit/5a4ccd3b70045b808ac4be8b1cd8d9e6b0112a4f))
* update package versions and enhance documentation for clarity ([b158eda](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b158eda2aac536d54e27f4310b53d1d7130f89c8))
* update package versions to remove beta tags and set to stable releases ([af9aa58](https://github.com/ailuracollective/nestjs-hono-adapter/commit/af9aa58a067dbf637ede8805ac301edeea08e8db))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))

## [2.0.0-beta.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v2.0.0-beta...v2.0.0-beta.1) (2026-10-16)


### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))

## [2.0.0-beta](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.4.1...v2.0.0-beta) (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* `@Query()` and URL-encoded bodies no longer parse with the `qs` grammar. `filter[name]` is now the literal key `filter[name]` instead of `{ filter: { name } }`, and a bracket suffix no longer builds a list or an object.
* a bootstrap that names no transport now serves through Bun's own server, so a deployment on Node names nodeServer()
    - one import, no other change. The shared overrideGlobalObjects
    option is gone with that default; the Node transport keeps its own.
    The conditional import gives the module a top-level await, so the
    package can no longer be loaded with require(). WebSockets on Node
    are unaffected: the Bun transport carries no helper there and the ws
    package falls back to @hono/node-ws, as before.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* add the compatibility bridge region and its first bridges ([71e7428](https://github.com/ailuracollective/nestjs-hono-adapter/commit/71e7428254481984a2920bf87c3c4fb434943b93))
* answer `request.raw` with nothing when no carrier arrived ([68212f9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/68212f9093759383a0994021f5bcabb51dde3e4d))
* **benchmarks:** add resource usage metrics and reporting to benchmark suite ([9a1fb17](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9a1fb172ae413e739fc187886325d45bf731847e))
* integrate [@socket](https://github.com/socket).io/bun-engine support and enhance Bun transport handling ([c43031b](https://github.com/ailuracollective/nestjs-hono-adapter/commit/c43031b5cd073132777d8c6542c5457b14d5aff8))
* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))
* read the query string and form bodies flat ([7c8c798](https://github.com/ailuracollective/nestjs-hono-adapter/commit/7c8c798190ebe80dbcbf35f0451154282d026b29))
* resolve a named view engine on first render ([3a5fef9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3a5fef92d2e4b51d9732d9e0f8fb283c734960f5))
* serve through Bun when no transport is named ([#172](https://github.com/ailuracollective/nestjs-hono-adapter/issues/172)) ([ac126d5](https://github.com/ailuracollective/nestjs-hono-adapter/commit/ac126d51fac8d29a51275c6a9225fe880e7752d5))
* update NestJS dependencies to support version ranges and enhance request body handling ([3430361](https://github.com/ailuracollective/nestjs-hono-adapter/commit/343036132095d55306b701d02b697903106022f8))


### Bug Fixes

* answer @Controller({ host }) routes instead of failing with a 500 ([#181](https://github.com/ailuracollective/nestjs-hono-adapter/issues/181)) ([a80f4a7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a80f4a7295431e3e914b385deaec720806c972c5))
* default the Node transport's overrideGlobalObjects to true ([#183](https://github.com/ailuracollective/nestjs-hono-adapter/issues/183)) ([6af686a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6af686a6cb0e4002b78f7bec59a09a7a3faa04fc))
* Express bridge and request path diverge from Express/Nest ([#193](https://github.com/ailuracollective/nestjs-hono-adapter/issues/193)) ([f8a3658](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f8a3658ad506dcfa7c19bec96250eb53f6ce352f))
* Express middleware surface, streamed bodies, and urlencoded GraphQL ([#191](https://github.com/ailuracollective/nestjs-hono-adapter/issues/191)) ([3565eb4](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3565eb4b52af914e0d48bcfc7e467fda2978398f))
* hand Hono an environment when a request is injected ([9c3e865](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9c3e86525d411aaad4e8a5842410cbe7403ec3ae))
* hold every bridged continuation open ([0717631](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0717631e2bda58dddef87bf47508880ccaf61d0e))
* keep a write to a get-only member such as res.req ([#199](https://github.com/ailuracollective/nestjs-hono-adapter/issues/199)) ([0c67145](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0c67145f342013c7ce5636edc0426ea8ff6627b1))
* keep the request's body, bag and params across bridges ([d16f6f9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/d16f6f9e186851c4329faf5a1b70613d20cfb2cd))
* **multipart:** mark the island across duplicated core copies ([3488b19](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3488b19045f3b8a8cd64e72357ad61cecb39c38c))
* refuse TLS options Bun cannot read instead of serving in the clear ([#197](https://github.com/ailuracollective/nestjs-hono-adapter/issues/197)) ([8048a64](https://github.com/ailuracollective/nestjs-hono-adapter/commit/8048a64e5753a5e7357b74e58f9d3d2a974ca7bb))
* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* send no security headers unless secureHeaders asks for them ([#182](https://github.com/ailuracollective/nestjs-hono-adapter/issues/182)) ([b42f037](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b42f037013ee2c6542478f652ac37fa70889c9e0))
* stream a StreamableFile across duplicated copies ([5a4ccd3](https://github.com/ailuracollective/nestjs-hono-adapter/commit/5a4ccd3b70045b808ac4be8b1cd8d9e6b0112a4f))
* update package versions and enhance documentation for clarity ([b158eda](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b158eda2aac536d54e27f4310b53d1d7130f89c8))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))
