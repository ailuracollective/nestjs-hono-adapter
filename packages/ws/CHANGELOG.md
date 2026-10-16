# Changelog

## [0.2.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/ws-v0.1.0...ws-v0.2.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))
* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))
* **ws:** export the gateway socket type ([6f63562](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6f635624ffa2f8670edc3420ca6e08f856e6c988))


### Bug Fixes

* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* update version of ws package to 0.1.0 and adjust release configuration ([f29a2d5](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f29a2d5e7a097b23ded7d0f6f863e33c010ba23b))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))

## [0.1.0-beta.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/ws-v0.1.0-beta...ws-v0.1.0-beta.1) (2026-10-16)


### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))

## 0.1.0-beta (2026-10-16)


### ⚠ BREAKING CHANGES

* the internal `app-settings.ts` is removed; the application methods are declared in `application.ts`.
* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* read the application like Nest's own platforms ([570e70a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/570e70a12f5b03f96f7f77a706080c9e821e7839))
* **ws:** export the gateway socket type ([6f63562](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6f635624ffa2f8670edc3420ca6e08f856e6c988))


### Bug Fixes

* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))
