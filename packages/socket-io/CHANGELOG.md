# Changelog

## [0.2.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/socket-io-v0.1.0...socket-io-v0.2.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))
* integrate [@socket](https://github.com/socket).io/bun-engine support and enhance Bun transport handling ([c43031b](https://github.com/ailuracollective/nestjs-hono-adapter/commit/c43031b5cd073132777d8c6542c5457b14d5aff8))
* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))


### Bug Fixes

* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* update socket-io and ws package versions to 0.1.0 ([7a962b9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/7a962b9036b82bfd2f2fed26d063cc7cf4f5fc2f))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))

## [0.1.0-beta.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/socket-io-v0.1.0-beta...socket-io-v0.1.0-beta.1) (2026-10-16)


### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))

## 0.1.0-beta (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* integrate [@socket](https://github.com/socket).io/bun-engine support and enhance Bun transport handling ([c43031b](https://github.com/ailuracollective/nestjs-hono-adapter/commit/c43031b5cd073132777d8c6542c5457b14d5aff8))
* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))


### Bug Fixes

* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))
