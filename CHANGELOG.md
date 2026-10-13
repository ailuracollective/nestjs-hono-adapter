## [1.3.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.2.4...v1.3.0) (2026-10-09)


### Features

* add comprehensive tests for NestJS integration with various modules ([1ef6c9e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/1ef6c9ec2d77a5615c5d1751cc480a5b663422c2))


## [1.5.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.4.1...v1.5.0) (2026-10-13)


### Features

* add cleanup job for closed pull requests in Cloudflare examples workflow ([1fd541c](https://github.com/ailuracollective/nestjs-hono-adapter/commit/1fd541cb92f81d9b0a26e3fb2e6a2e097b3ad50d))
* add inject(), the in-process request helper for tests ([#119](https://github.com/ailuracollective/nestjs-hono-adapter/issues/119)) ([f450250](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f4502501e5b637d59deecec9abb2ab1fbe7e05eb))
* add the multipart upload island as ./multipart ([6f5acda](https://github.com/ailuracollective/nestjs-hono-adapter/commit/6f5acda795a37abe292baefab81eee8da1364276)), closes [#100](https://github.com/ailuracollective/nestjs-hono-adapter/issues/100)
* add the socket.io adapter behind ./socket-io ([#138](https://github.com/ailuracollective/nestjs-hono-adapter/issues/138)) ([8ae2f13](https://github.com/ailuracollective/nestjs-hono-adapter/commit/8ae2f13b207a5fca12a15432d85addcfef47f863))
* build the fetch websocket option from the host's own helper ([#99](https://github.com/ailuracollective/nestjs-hono-adapter/issues/99)) ([010893a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/010893abbdaef8bf7841592912f0f7c6fc37645c))
* honour setOnRequestHook() and setOnResponseHook() ([#105](https://github.com/ailuracollective/nestjs-hono-adapter/issues/105)) ([8b1f3d5](https://github.com/ailuracollective/nestjs-hono-adapter/commit/8b1f3d5502b0ec315010eb34cfac2ff722d1fb04))
* implement setLocal() and the settings the adapter owns ([#143](https://github.com/ailuracollective/nestjs-hono-adapter/issues/143)) ([50b6d44](https://github.com/ailuracollective/nestjs-hono-adapter/commit/50b6d44dbf732f41c37d7236e75baf8d4aa0dd96))
* read websocket frames with the deployment's own parser ([#107](https://github.com/ailuracollective/nestjs-hono-adapter/issues/107)) ([e399f14](https://github.com/ailuracollective/nestjs-hono-adapter/commit/e399f1405c06be1260f42afc436300ffd9341338))
* take the signature forms both platform adapters accept ([#113](https://github.com/ailuracollective/nestjs-hono-adapter/issues/113)) ([da4cf1e](https://github.com/ailuracollective/nestjs-hono-adapter/commit/da4cf1e00f27665b9f940e5e72922faecbc83d20))


### Bug Fixes

* allow every origin when enableCors() names none ([#162](https://github.com/ailuracollective/nestjs-hono-adapter/issues/162)) ([bbc2113](https://github.com/ailuracollective/nestjs-hono-adapter/commit/bbc21137475b44ad9dd8a7784158fb102c0daf0d)), closes [#154](https://github.com/ailuracollective/nestjs-hono-adapter/issues/154)
* answer 400 for a path with an invalid percent-encoding ([#103](https://github.com/ailuracollective/nestjs-hono-adapter/issues/103)) ([b1ef250](https://github.com/ailuracollective/nestjs-hono-adapter/commit/b1ef2502c2a6f857afa3df1508c1827d0ac214d1))
* answer 400 when a multipart content type declares no boundary ([#111](https://github.com/ailuracollective/nestjs-hono-adapter/issues/111)) ([fc57c39](https://github.com/ailuracollective/nestjs-hono-adapter/commit/fc57c3910fe0cf5596884922055b650a82857128))
* answer listen() on the fetch transport with the reason ([#160](https://github.com/ailuracollective/nestjs-hono-adapter/issues/160)) ([5cf6a26](https://github.com/ailuracollective/nestjs-hono-adapter/commit/5cf6a269ea83455a8acd3e6f6291283b3819b028))
* bind a gateway connection on its first frame, not on open ([#97](https://github.com/ailuracollective/nestjs-hono-adapter/issues/97)) ([722e6a7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/722e6a76068b18aae1bcb6e75e9431addbe142d3))
* enforce the body limit while the request body is read ([#156](https://github.com/ailuracollective/nestjs-hono-adapter/issues/156)) ([4ab2819](https://github.com/ailuracollective/nestjs-hono-adapter/commit/4ab2819ca7e424a79842ea17c0dddfefa4d143d5))
* harden the multipart island after review ([0b97919](https://github.com/ailuracollective/nestjs-hono-adapter/commit/0b9791945caf87004f41c8c30a8be1bb67fb35d3))
* invoke the callback a Node caller passes to close() ([#140](https://github.com/ailuracollective/nestjs-hono-adapter/issues/140)) ([1332918](https://github.com/ailuracollective/nestjs-hono-adapter/commit/133291899d6719f462bd6bc7d30058b88366917a))
* keep a repeated set-cookie as separate headers ([#157](https://github.com/ailuracollective/nestjs-hono-adapter/issues/157)) ([f3d65d7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f3d65d748dc342896c757b6645722b150c49e924)), closes [#151](https://github.com/ailuracollective/nestjs-hono-adapter/issues/151)
* read what the payload declares about its own encoding ([#158](https://github.com/ailuracollective/nestjs-hono-adapter/issues/158)) ([f0e10e6](https://github.com/ailuracollective/nestjs-hono-adapter/commit/f0e10e6f03cdd8acef53dafe5f993b589daeb0c6))
* render the view on the status the route declared ([#161](https://github.com/ailuracollective/nestjs-hono-adapter/issues/161)) ([bda3fab](https://github.com/ailuracollective/nestjs-hono-adapter/commit/bda3fabd789a0132ce7ddf78bf6a3740155818d3)), closes [#153](https://github.com/ailuracollective/nestjs-hono-adapter/issues/153)
* restore the index ceiling the body-limit merge dropped ([#159](https://github.com/ailuracollective/nestjs-hono-adapter/issues/159)) ([a6b6cc0](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a6b6cc0882ba57d1a2a4d0831f3d60c6347374c6)), closes [#149](https://github.com/ailuracollective/nestjs-hono-adapter/issues/149)
* send a string as HTML through the Express surface ([#92](https://github.com/ailuracollective/nestjs-hono-adapter/issues/92)) ([a786ad1](https://github.com/ailuracollective/nestjs-hono-adapter/commit/a786ad16e37bdd798d16e4c6a38cfa1fd68ba80a))
* stop a process-wide Response swap from failing neighbouring tests ([#148](https://github.com/ailuracollective/nestjs-hono-adapter/issues/148)) ([34a325a](https://github.com/ailuracollective/nestjs-hono-adapter/commit/34a325aff74d3b50e915fa49f2b08500ba58da24))

## [1.4.1](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.4.0...v1.4.1) (2026-10-11)


### Bug Fixes

* pass the oxfmt check on AGENTS.md ([4f403ca](https://github.com/ailuracollective/nestjs-hono-adapter/commit/4f403ca5b4e241175d166774f415d6a5eb1dab59))

## [1.4.0](https://github.com/ailuracollective/nestjs-hono-adapter/compare/v1.3.0...v1.4.0) (2026-10-10)


### Features

* serve Nest through a runtime transport, Node by default ([#75](https://github.com/ailuracollective/nestjs-hono-adapter/issues/75)) ([5454ae7](https://github.com/ailuracollective/nestjs-hono-adapter/commit/5454ae7aaffbdd84e77cc5846a8d11831a32bf05))

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
