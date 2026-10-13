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
} from '../interfaces/index.ts';

/** The bytes one random file name stands for. */
const RANDOM_BYTES = 16;

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
  /**
   * The folder files are written to, `os.tmpdir()` by default.
   * A string is created when the engine is built; a function
   * has to answer a folder that already exists.
   */
  destination?: string | NameResolver;
  /** The name within `destination`, random hex by default. */
  filename?: NameResolver;
}

function resolveName(
  resolver: NameResolver,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<string> {
  return new Promise((resolve, reject) => {
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
}

/**
 * Writes one file, answering what disk storage recorded about
 * it.
 */
async function store(
  request: unknown,
  file: IncomingMultipartFile,
  resolveDestination: NameResolver,
  resolveFilename: NameResolver,
): Promise<Partial<UploadedMultipartFile>> {
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
  // As in multer, the path is known to the file before it is
  // written, so a failed write can remove it.
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
}

/**
 * Writes each file to disk, with multer's `diskStorage`
 * defaults and file shape: `destination`, `filename`, `path`
 * and `size`.
 */
function diskStorage(
  options: DiskStorageOptions = {},
): MultipartStorageEngine {
  let resolveDestination: NameResolver;
  if (typeof options.destination === 'string') {
    const destination = options.destination;
    mkdirSync(destination, { recursive: true });
    resolveDestination = (_request, _file, callback) => {
      callback(null, destination);
    };
  } else {
    resolveDestination =
      options.destination ??
      ((_request, _file, callback) => {
        callback(null, tmpdir());
      });
  }
  const resolveFilename: NameResolver =
    options.filename ??
    ((_request, _file, callback) => {
      callback(null, randomBytes(RANDOM_BYTES).toString('hex'));
    });

  return {
    async _handleFile(request, file, callback) {
      try {
        const info = await store(
          request,
          file,
          resolveDestination,
          resolveFilename,
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
        // The file is gone either way, which is what removal means.
      }
      callback(null);
    },
  };
}

export { diskStorage };
export type { DiskStorageOptions };
