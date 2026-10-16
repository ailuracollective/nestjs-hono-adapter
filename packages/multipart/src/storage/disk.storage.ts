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

const RANDOM_BYTES = 16;

type NameCallback = (error: Error | null, value: string) => void;

type NameResolver = (request: unknown, file: IncomingMultipartFile, callback: NameCallback) => void;

interface DiskStorageOptions {
  destination?: string | NameResolver;
  filename?: NameResolver;
}

const resolveName = (
  resolver: NameResolver,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<string> =>
  new Promise((resolve, reject) => {
    resolver(request, file, (error: Error | null | undefined, value) => {
      if (error === null || error === undefined) {
        resolve(value);
      } else {
        reject(error);
      }
    });
  });

const containedTarget = (destination: string, filename: string): string => {
  const resolvedDestination = path.resolve(destination);
  const resolvedTarget = path.resolve(resolvedDestination, filename);
  if (
    resolvedTarget !== resolvedDestination &&
    !resolvedTarget.startsWith(resolvedDestination + path.sep)
  ) {
    throw new TypeError('Unsafe path');
  }
  return resolvedTarget;
};

const store = async (
  request: unknown,
  file: IncomingMultipartFile,
  resolveDestination: NameResolver,
  resolveFilename: NameResolver,
): Promise<Partial<UploadedMultipartFile>> => {
  const destination = await resolveName(resolveDestination, request, file);
  const filename = await resolveName(resolveFilename, request, file);
  const target = containedTarget(destination, filename);
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

const diskStorage = (options: DiskStorageOptions = {}): MultipartStorageEngine => {
  const { destination, filename } = resolveDiskStorageOptions(options);

  return {
    async _handleFile(request, file, callback) {
      try {
        const info = await store(request, file, destination, filename);
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
