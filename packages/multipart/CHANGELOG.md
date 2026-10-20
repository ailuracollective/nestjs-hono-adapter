# Changelog

## [0.2.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/multipart-v0.2.0...multipart-v0.2.1) (2026-10-20)


### Bug Fixes

* align companion peer dependencies with core 2.x ([#206](https://github.com/ailuracollective/nestjs-hono-adapter/issues/206)) ([bb64a39](https://github.com/ailuracollective/nestjs-hono-adapter/commit/bb64a3911d54f46ac8a9cb257281e72c4eba88d0))
* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))

## [0.2.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/multipart-v0.1.0...multipart-v0.2.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))


### Bug Fixes

* **multipart:** mark the island across duplicated core copies ([3488b19](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3488b19045f3b8a8cd64e72357ad61cecb39c38c))
* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* tell a Nest file and exception apart by shape ([a10e869](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a10e8694a4534e1bcb72d3818328607ea4ed1243))
* update package versions to remove beta tags and set to stable releases ([af9aa58](https://github.com/ailuracollective/nestjs-hono-adapter/commit/af9aa58a067dbf637ede8805ac301edeea08e8db))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))

## [0.1.0-beta.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/multipart-v0.1.0-beta...multipart-v0.1.0-beta.1) (2026-10-16)


### Features

* add LICENSE files and update package.json to include LICENSE in files ([03dc079](https://github.com/ailuracollective/nestjs-hono-adapter/commit/03dc079e33fc50910b89758790558c1fbd62f104))

## 0.1.0-beta (2026-10-16)


### ⚠ BREAKING CHANGES

* a deployment that served a gateway through @ailura/nestjs-hono-adapter/ws installs @ailura/nestjs-hono-adapter-ws and imports it from there. The ws ceiling leaves the size gate with the entrypoint; the WebSocket peers stay optional and a deployment that serves no gateway still installs neither.

### Bug Fixes

* **multipart:** mark the island across duplicated core copies ([3488b19](https://github.com/ailuracollective/nestjs-hono-adapter/commit/3488b19045f3b8a8cd64e72357ad61cecb39c38c))
* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))
* tell a Nest file and exception apart by shape ([a10e869](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a10e8694a4534e1bcb72d3818328607ea4ed1243))


### Miscellaneous Chores

* rename the packages and stop publishing from the root ([#167](https://github.com/ailuracollective/nestjs-hono-adapter/issues/167)) ([fb73527](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fb735277cfb08e66cfc31ad6bc000948beca671b))
