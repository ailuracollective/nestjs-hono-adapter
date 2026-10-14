/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/no-useless-undefined */
/* eslint-disable typescript/strict-void-return */
/* eslint-disable typescript/no-misused-promises */
/* eslint-disable typescript/explicit-function-return-type */
/* eslint-disable promise/avoid-new */
/* eslint-disable node/no-sync */
/* eslint-disable node/callback-return */
/* eslint-disable max-params */
/* eslint-disable init-declarations */

import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type {
  IncomingMultipartFile,
  MultipartStorageEngine,
  UploadedMultipartFile,
} from '#multipart/interfaces/index';

/** The bytes one random file name stands for. */
const RANDOM_BYTES = 16;

/** Answers a resolved folder or file name. */
type NameCallback = (
  error: Error | null,
  value: string,
) => void;

/** Names a folder, or a file within one. */
type NameResolver = (
  request: unknown,
  file: IncomingMultipartFile,
  callback: NameCallback,
) => void;

/** What `diskStorage()` accepts. */
interface DiskStorageOptions {
  /** The folder files are written to. */
  destination?: string | NameResolver;
  /** The name within `destination`, random hex by default. */
  filename?: NameResolver;
}

/** Resolves a name through one of the engine's resolvers. */
const resolveName = (
  resolver: NameResolver,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<string> =>
  new Promise((resolve, reject) => {
    resolver(
      request,
      file,
      (error: Error | null | undefined, value) => {
        if (error === null || error === undefined) {
          resolve(value);
        } else {
          reject(error);
        }
      },
    );
  });

/** Writes one file and answers what disk storage recorded. */
const store = async (
  request: unknown,
  file: IncomingMultipartFile,
  resolveDestination: NameResolver,
  resolveFilename: NameResolver,
): Promise<Partial<UploadedMultipartFile>> => {
  const destination = await resolveName(
    resolveDestination,
    request,
    file,
  );
  const filename = await resolveName(
    resolveFilename,
    request,
    file,
  );
  const target = path.join(destination, filename);
  file.path = target;
  const out = createWriteStream(target);
  try {
    await pipeline(file.stream, out);
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
  return {
    destination,
    filename,
    path: target,
    size: out.bytesWritten,
  };
};

/** Resolves the destination and filename configuration. */
const resolveDiskStorageOptions = (
  options: DiskStorageOptions,
): {
  destination: NameResolver;
  filename: NameResolver;
} => {
  let destination: NameResolver;

  if (typeof options.destination === 'string') {
    const directory = options.destination;
    mkdirSync(directory, { recursive: true });

    destination = (_request, _file, callback) => {
      callback(null, directory);
    };
  } else {
    destination =
      options.destination ??
      ((_request, _file, callback) => {
        callback(null, tmpdir());
      });
  }

  const filename =
    options.filename ??
    ((_request, _file, callback) => {
      callback(null, randomBytes(RANDOM_BYTES).toString('hex'));
    });

  return { destination, filename };
};

/** Writes each file to disk, with multer's defaults. */
const diskStorage = (
  options: DiskStorageOptions = {},
): MultipartStorageEngine => {
  const { destination, filename } =
    resolveDiskStorageOptions(options);

  return {
    async _handleFile(request, file, callback) {
      try {
        const info = await store(
          request,
          file,
          destination,
          filename,
        );
        callback(null, info);
      } catch (error) {
        callback(error);
      }
    },
    async _removeFile(_request, file, callback) {
      const target = file.path;
      delete file.destination;
      delete file.filename;
      delete file.path;

      try {
        await unlink(target ?? '');
      } catch {
        // The file is gone either way.
      }

      callback(null);
    },
  };
};

export { diskStorage };
export type { DiskStorageOptions };
