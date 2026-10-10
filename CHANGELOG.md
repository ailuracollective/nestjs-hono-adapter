## [1.3.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.2.4...v1.3.0) (2026-10-09)


### Features

* add comprehensive tests for NestJS integration with various modules ([1ef6c9e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/1ef6c9ec2d77a5615c5d1751cc480a5b663422c2))


## [1.2.4](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.2.3...v1.2.4) (2026-10-08)


### Performance Improvements

* build the request bag on demand ([#53](https://github.com/ailuracollective/nestjs-hono-adapter/issues/53)) ([9b2baeb](https://github.com/ailuracollective/nestjs-hono-adapter/commit/9b2baeb84b38045948fafef2be84526c59cc7503))


## [1.2.3](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.2.2...v1.2.3) (2026-10-08)


### Bug Fixes

* open and end an event stream on a runtime with no socket ([#55](https://github.com/ailuracollective/nestjs-hono-adapter/issues/55)) ([07de971](https://github.com/ailuracollective/nestjs-hono-adapter/commit/07de971c049898c5428f24cfa21930558c19f169))


## [1.2.2](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.2.1...v1.2.2) (2026-10-08)


### Bug Fixes

* keep the platform's own classes on Cloudflare Workers ([#54](https://github.com/ailuracollective/nestjs-hono-adapter/issues/54)) ([93df8d7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/93df8d78c417defc4a15eb70aad0148a2e821b74))


## [1.2.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.2.0...v1.2.1) (2026-10-05)


### Bug Fixes

* export TrustProxy and type registerSecurityHook ([#51](https://github.com/ailuracollective/nestjs-hono-adapter/issues/51)) ([ba5c136](https://github.com/ailuracollective/nestjs-hono-adapter/commit/ba5c1366235c9ff2a0848db84c26bf4b6a292710))


## [1.2.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.1.5...v1.2.0) (2026-10-05)


### Features

* bring the adapter to parity with the platform adapters ([#50](https://github.com/ailuracollective/nestjs-hono-adapter/issues/50)) ([cc0ec68](https://github.com/ailuracollective/nestjs-hono-adapter/commit/cc0ec68811f839ed798daa501ca242c98f39a765)), closes [#46](https://github.com/ailuracollective/nestjs-hono-adapter/issues/46)


## [1.1.5](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.1.4...v1.1.5) (2026-10-04)


### Bug Fixes

* reconstruct the wildcard parameter the router reads it by ([#49](https://github.com/ailuracollective/nestjs-hono-adapter/issues/49)) ([69bb43f](https://github.com/ailuracollective/nestjs-hono-adapter/commit/69bb43f9c1729cbc21e101622921ae93b9e6a9c3)), closes [#48](https://github.com/ailuracollective/nestjs-hono-adapter/issues/48)


## [1.1.4](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.1.3...v1.1.4) (2026-10-04)


### Bug Fixes

* read the media-type version by name and from every media range ([#47](https://github.com/ailuracollective/nestjs-hono-adapter/issues/47)) ([b27e6af](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b27e6af221ba9694fa5957cc2924512fc1ee268c)), closes [#46](https://github.com/ailuracollective/nestjs-hono-adapter/issues/46)


## [1.1.3](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.1.2...v1.1.3) (2026-10-04)


### Reverts

* Revert "chore: move the toolchain from bun to pnpm and vitest" ([#41](https://github.com/ailuracollective/nestjs-hono-adapter/issues/41)) ([da96420](https://github.com/ailuracollective/nestjs-hono-adapter/commit/da96420c25a07f60ad4b6f7647ecf5e0e236ba85))


## [1.1.2](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.1.1...v1.1.2) (2026-09-28)


### Bug Fixes

* release the pnpm workspace build fix under a patch version ([6ea958e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6ea958e4f8d90c38713a285672aaa5b0cdfc4c47))


## [1.1.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.1.0...v1.1.1) (2026-09-22)


### Bug Fixes

* correct copyright name in LICENSE file ([a163905](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a163905190e16e840cb7ac4f36ea469625709086))


## [1.1.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.0.0...v1.1.0) (2026-09-22)


### Features

* serve the application on Cloudflare Workers ([#3](https://github.com/ailuracollective/nestjs-hono-adapter/issues/3)) ([7f91e94](https://github.com/ailuracollective/nestjs-hono-adapter/commit/7f91e9414742e31d5b5daf53d32b331830bd0a65))


## [1.0.0](https://github.com/ailuracollective/nestjs-hono-adapter/tree/v1.0.0) (2026-09-21)


### Features

* run Nest applications on Hono ([36a8b26](https://github.com/ailuracollective/nestjs-hono-adapter/commit/36a8b26c5e3ee24707ad74fe64430fdaf9a066b1))


### Bug Fixes

* point package metadata at the transferred repository ([2c054e3](https://github.com/ailuracollective/nestjs-hono-adapter/commit/2c054e3a5f888c30804a7e86e6a1a2467ddf5497))
* update package name ([56a7585](https://github.com/ailuracollective/nestjs-hono-adapter/commit/56a75859a7c51c4aeabd37c9aca49b3ad6206b99))
* run prepack with direct clean and build command ([74ba7a0](https://github.com/ailuracollective/nestjs-hono-adapter/commit/74ba7a0f5d5d4c4134d965d9a6de008c1b906cc8))
* ensure build script runs during prepare phase ([611c71b](https://github.com/ailuracollective/nestjs-hono-adapter/commit/611c71b7cb659780b4d2d259427fc26d68859941))


### Miscellaneous Chores

* **release:** configure semantic-release and the release workflow ([d1c1ff9](https://github.com/ailuracollective/nestjs-hono-adapter/commit/d1c1ff9cf5b73d59eacc48bce2606dd427ee52ee))
* **release:** add semantic-release tooling ([c6e7d08](https://github.com/ailuracollective/nestjs-hono-adapter/commit/c6e7d084e1460f1869498f4311029fbb794e91e4))


### Continuous Integration

* **release:** authenticate npm publishing with OIDC instead of a token ([ac2ae07](https://github.com/ailuracollective/nestjs-hono-adapter/commit/ac2ae07d44914c623fdf594c1dcbf70a586c91ad))
