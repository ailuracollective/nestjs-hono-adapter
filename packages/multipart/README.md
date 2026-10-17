# @ailura/nestjs-platform-hono-multipart

[![CI](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ailuracollective/nestjs-hono-adapter/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@ailura/nestjs-platform-hono-multipart.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-multipart) [![npm downloads](https://img.shields.io/npm/dm/@ailura/nestjs-platform-hono-multipart.svg)](https://www.npmjs.com/package/@ailura/nestjs-platform-hono-multipart) [![bundle size](https://img.shields.io/badge/bundle%20size-≤4.3kb-brightgreen)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/packages/multipart/.size-limit.json) [![Socket Badge](https://badge.socket.dev/npm/package/@ailura/nestjs-platform-hono-multipart)](https://socket.dev/npm/package/@ailura/nestjs-platform-hono-multipart) [![Snyk security](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ailuracollective/nestjs-hono-adapter?targetFile=package.json) [![GitHub license](https://img.shields.io/github/license/ailuracollective/nestjs-hono-adapter.svg)](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/LICENSE)

`multipart/form-data` uploads for [`@ailura/nestjs-hono-adapter`](https://www.npmjs.com/package/@ailura/nestjs-hono-adapter), parsed with multer's semantics on top of `busboy`. It follows `@nestjs/platform-fastify/multipart`, not `@nestjs/platform-express/multer`: only the interceptor function names and the option keys match Express.

It is a **capability**: an application imports it, and only where it accepts an upload — the HTTP entrypoint never loads it.

## Install

```sh
bun add @ailura/nestjs-platform-hono-multipart busboy
```

Peers on `@ailura/nestjs-hono-adapter` (`>=2 <3`) and `@nestjs/common`; install the adapter alongside it.

## Use

```ts
import {
  FileInterceptor,
  type UploadedMultipartFile,
} from '@ailura/nestjs-platform-hono-multipart';

@Post('avatar')
@UseInterceptors(FileInterceptor('file'))
upload(@UploadedFile() file: UploadedMultipartFile) {
  return { size: file.size };
}
```

`@UploadedFile()` reads `req.file`, `@UploadedFiles()` reads `req.files`, and the text fields land in `req.body`.

| Interceptor             | Stores                                            |
| ----------------------- | ------------------------------------------------- |
| `FileInterceptor`       | One file in a named field → `req.file`            |
| `FilesInterceptor`      | Up to `maxCount` files in a named field → array   |
| `FileFieldsInterceptor` | Files in each of several fields → grouped by name |
| `AnyFilesInterceptor`   | Every file, any field → array                     |
| `NoFilesInterceptor`    | Text fields only; a file is a `400`               |
| `FileStreamInterceptor` | One file in a named field → a live stream         |

`FileStreamInterceptor` stores nothing: the handler is handed a `MultipartFileStream` whose `stream` carries the bytes as they arrive, so a file larger than memory or disk is piped straight through. Only what the handler reads is taken from the client, and whatever it leaves unread is discarded once the handler has answered.

```ts
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import {
  FileStreamInterceptor,
  type MultipartFileStream,
} from '@ailura/nestjs-platform-hono-multipart';

@Post('ingest')
@UseInterceptors(FileStreamInterceptor('file'))
async ingest(@UploadedFile() file: MultipartFileStream) {
  await pipeline(file.stream, createWriteStream('/tmp/ingest'));
  return { name: file.originalname };
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `dest` | `string` | — | Folder for disk storage when no `storage` |
| `storage` | `MultipartStorageEngine` | memory | The engine that stores each file |
| `limits` | `MultipartLimits \| ((req) => MultipartLimits)` | — | Size and count ceilings, as multer's |
| `preservePath` | `boolean` | `false` | Keep the whole path a file arrived with |
| `defParamCharset` | `string` | `latin1` | Charset for part header values |
| `fileFilter` | `(req, file, cb) => void` | — | Accept or refuse each file |

`MultipartModule.register(options)` (and `registerAsync`) provides defaults every interceptor in the importing module merges over. `memoryStorage()` keeps each file in `file.buffer`; `diskStorage({ destination, filename })` writes it and sets `destination`, `filename` and `path`. Both implement multer's `_handleFile` / `_removeFile` contract, so an engine written for `@nestjs/platform-express` works here unchanged.

The package needs `busboy` and works where Node streams do — the Node and Bun transports. Importing it marks the adapter, so on every transport the request path leaves a multipart body for the interceptors: a multipart route without one reads no `body` and no `files`. An application that does not import the package keeps Hono's own parser, which lands the fields on `req.body` and the files on `req.files`.

## Documentation

See [Uploads](https://github.com/ailuracollective/nestjs-hono-adapter/blob/main/docs/features.md#uploads) for the streaming rules, the limits, and the interaction with the adapter's own `bodyLimit`.

## License

MIT
