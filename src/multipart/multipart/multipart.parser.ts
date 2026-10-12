import { BadRequestException } from '@nestjs/common';
import Busboy from 'busboy';
import type { BusboyConfig } from 'busboy';
import { Readable } from 'node:stream';

import type { NestContext } from '../../core/context.ts';
import type { NestRequest } from '../../core/request.ts';
import type {
  IncomingMultipartFile,
  MultipartField,
  MultipartLimits,
  MultipartOptions,
  MultipartStorageEngine,
  UploadedMultipartFile,
} from '../interfaces/index.ts';
import {
  diskStorage,
  memoryStorage,
} from '../storage/index.ts';
import { appendField } from './append-field.util.ts';
import { busboyExceptions } from './multipart.constants.ts';
import { MultipartError } from './multipart.error.ts';
import { transformException } from './multipart.utils.ts';

/**
 * Where accepted files end up, named after multer's file
 * appenders.
 */
type FileStrategy = 'VALUE' | 'ARRAY' | 'OBJECT' | 'NONE';

/** What one interceptor accepts, and where the files go. */
interface UploadSpec {
  /**
   * Accepted fields, or `'ANY'` for every field without a
   * ceiling.
   */
  fields: MultipartField[] | 'ANY';
  strategy: FileStrategy;
}

/**
 * A file stream, which busboy truncates at a `fileSize`
 * ceiling.
 */
type Truncatable = Readable & { truncated?: boolean };

/**
 * The storage a request uses, from `storage`, then `dest`, then
 * memory.
 */
function resolveStorage(
  options: MultipartOptions,
): MultipartStorageEngine {
  if (options.storage !== undefined) {
    return options.storage;
  }
  if (options.dest !== undefined) {
    return diskStorage({ destination: options.dest });
  }
  return memoryStorage();
}

/**
 * Rejects a limit that is not a non-negative integer or
 * `Infinity`, as multer does: busboy compares most limits with
 * strict equality, so such a value would silently disable the
 * ceiling.
 */
function validateLimits(
  limits: MultipartLimits | undefined,
): void {
  for (const [key, value] of Object.entries(limits ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (
      (Number.isInteger(value) && value >= 0) ||
      value === Infinity
    ) {
      continue;
    }
    throw new TypeError(
      `Expected limits.${key} to be a non-negative integer or Infinity`,
    );
  }
}

function resolveLimits(
  request: unknown,
  options: MultipartOptions,
): MultipartLimits | undefined {
  const { limits } = options;
  if (typeof limits !== 'function') {
    validateLimits(limits);
    return limits;
  }
  const resolved = limits(request);
  validateLimits(resolved);
  return resolved;
}

/** Says whether a content type is a multipart form. */
function isMultipart(contentType: string): boolean {
  return contentType
    .toLowerCase()
    .startsWith('multipart/form-data');
}

/**
 * Reverses the escapes a browser applies to a file name (`%0A`,
 * `%0D`, `%22`), as multer does.
 */
function decodeFormDataName(name: string): string {
  return name.replaceAll(/%0A|%0D|%22/giu, (match) => {
    switch (match.toUpperCase()) {
      case '%0A':
        return '\n';
      case '%0D':
        return '\r';
      default:
        return '"';
    }
  });
}

function checkFieldNameSize(
  rawName: string,
  limits: MultipartLimits | undefined,
): void {
  if (
    typeof limits?.fieldNameSize === 'number' &&
    rawName.length > limits.fieldNameSize
  ) {
    throw new MultipartError('LIMIT_FIELD_KEY');
  }
}

/**
 * Adds one text field to the body, with multer's checks and
 * order.
 */
function appendTextField(
  body: Record<string, unknown>,
  rawName: string,
  value: string,
  info: { nameTruncated: boolean; valueTruncated: boolean },
  limits: MultipartLimits | undefined,
): void {
  const name = decodeFormDataName(rawName);
  if (info.nameTruncated) {
    throw new MultipartError('LIMIT_FIELD_KEY');
  }
  if (info.valueTruncated) {
    throw new MultipartError('LIMIT_FIELD_VALUE', name);
  }
  checkFieldNameSize(rawName, limits);
  if (!appendField(body, name, value)) {
    throw new MultipartError('INVALID_FIELD_NAME', name);
  }
}

/**
 * Asks the `fileFilter`, which multer allows to be
 * asynchronous.
 */
function applyFileFilter(
  options: MultipartOptions,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<boolean> {
  const { fileFilter } = options;
  if (fileFilter === undefined) {
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    fileFilter(
      request,
      file,
      (error: Error | null | undefined, accept) => {
        if (error === null || error === undefined) {
          resolve(accept);
        } else {
          reject(error);
        }
      },
    );
  });
}

function storeFile(
  storage: MultipartStorageEngine,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<Partial<UploadedMultipartFile>> {
  return new Promise((resolve, reject) => {
    storage._handleFile(request, file, (error, info) => {
      if (error === undefined || error === null) {
        resolve(info ?? {});
      } else {
        reject(error);
      }
    });
  });
}

function removeFiles(
  storage: MultipartStorageEngine,
  request: unknown,
  files: UploadedMultipartFile[],
): Promise<void> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve) => {
          storage._removeFile(request, file, () => {
            resolve();
          });
        }),
    ),
  ).then(() => undefined);
}

/** The busboy configuration one request parses with. */
function configFor(
  contentType: string,
  limits: MultipartLimits | undefined,
  options: MultipartOptions,
): BusboyConfig {
  const config: BusboyConfig = {
    defParamCharset: options.defParamCharset ?? 'latin1',
    headers: { 'content-type': contentType },
    preservePath: options.preservePath ?? false,
  };
  if (limits !== undefined) {
    config.limits = limits;
  }
  return config;
}

/**
 * Busboy refuses a content type with no boundary by throwing
 * from its own constructor, synchronously. The guard around the
 * parse below therefore never sees that failure, and neither
 * does the mapping at the end of it: it has to be mapped here,
 * where it is raised, or a boundaryless request answers 500
 * where Express and Fastify answer 400.
 */
function createBusboy(
  config: BusboyConfig,
): ReturnType<typeof Busboy> {
  try {
    return Busboy(config);
  } catch (error: unknown) {
    throw transformException(error);
  }
}

/**
 * Stores one file and answers the shape multer gives it: a file
 * without a name is ignored, a file the filter refuses is
 * drained and skipped, and one busboy truncated at `fileSize`
 * is removed and refused.
 */
async function handleFile(
  name: string,
  stream: Truncatable,
  info: {
    filename?: string | undefined;
    encoding: string;
    mimeType: string;
  },
  options: MultipartOptions,
  request: unknown,
  storage: MultipartStorageEngine,
): Promise<UploadedMultipartFile | undefined> {
  const originalname = info.filename ?? '';
  if (originalname === '') {
    stream.resume();
    return undefined;
  }
  const file: IncomingMultipartFile = {
    encoding: info.encoding,
    fieldname: name,
    mimetype: info.mimeType,
    originalname: decodeFormDataName(originalname),
    stream,
  };
  if (!(await applyFileFilter(options, request, file))) {
    stream.resume();
    return undefined;
  }
  const stored = await storeFile(storage, request, file);
  const uploaded: UploadedMultipartFile = Object.assign(
    {
      encoding: file.encoding,
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: 0,
    },
    stored,
  );
  if (stream.truncated === true) {
    await removeFiles(storage, request, [uploaded]);
    throw new MultipartError('LIMIT_FILE_SIZE', name);
  }
  return uploaded;
}

/**
 * Parses a multipart body with multer's semantics, filling
 * `req.body`, `req.file` and `req.files`. A body that is not
 * multipart is left untouched, as multer leaves it.
 */
async function processMultipart(
  context: NestContext,
  request: NestRequest,
  spec: UploadSpec,
  options: MultipartOptions,
  storage: MultipartStorageEngine,
): Promise<void> {
  const contentType = context.req.header('content-type') ?? '';
  if (!isMultipart(contentType)) {
    return;
  }
  const web = context.req.raw.body;
  if (web === null) {
    throw new BadRequestException(
      busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FORM,
    );
  }

  const limits = resolveLimits(request, options);
  const busboy = createBusboy(
    configFor(contentType, limits, options),
  );
  const source = Readable.fromWeb(
    web as unknown as Parameters<typeof Readable.fromWeb>[0],
  );

  const body: Record<string, unknown> = Object.create(null);
  const slots: (UploadedMultipartFile | undefined)[] = [];
  const tasks: Promise<void>[] = [];
  const left = new Map<string, number>();
  if (spec.fields !== 'ANY') {
    for (const field of spec.fields) {
      left.set(field.name, field.maxCount ?? Infinity);
    }
  }
  let failure: unknown = undefined;
  let position = 0;

  busboy.on('field', (name, value, info) => {
    if (failure !== undefined) {
      return;
    }
    try {
      appendTextField(body, name, value, info, limits);
    } catch (error) {
      failure = error;
    }
  });

  busboy.on('file', (name, stream, info) => {
    const slot = position;
    position += 1;
    if (failure !== undefined) {
      stream.resume();
      return;
    }
    let remaining = left.get(name) ?? 0;
    if (spec.fields === 'ANY') {
      remaining = Infinity;
    }
    if (remaining <= 0) {
      failure ??= new MultipartError(
        'LIMIT_UNEXPECTED_FILE',
        name,
      );
      stream.resume();
      return;
    }
    left.set(name, remaining - 1);
    tasks.push(
      handleFile(
        name,
        stream,
        info,
        options,
        request,
        storage,
      ).then(
        (file) => {
          slots[slot] = file;
        },
        (error: unknown) => {
          failure ??= error;
          stream.resume();
        },
      ),
    );
  });

  busboy.on('partsLimit', () => {
    failure ??= new MultipartError('LIMIT_PART_COUNT');
  });
  busboy.on('filesLimit', () => {
    failure ??= new MultipartError('LIMIT_FILE_COUNT');
  });
  busboy.on('fieldsLimit', () => {
    failure ??= new MultipartError('LIMIT_FIELD_COUNT');
  });

  let parseError: unknown = undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      /**
       * A client that aborts mid-upload errors the source, and
       * `pipe` forwards nothing: left alone, that error is
       * unhandled and this promise never settles. Cancelling
       * busboy with it destroys the file stream busboy is
       * filling, so the storage tasks settle and the cleanup
       * below still runs.
       */
      const cancel = (error: unknown): void => {
        const reason =
          error instanceof Error
            ? error
            : new Error(String(error));
        source.unpipe(busboy);
        busboy.destroy(reason);
        reject(reason);
      };
      busboy.once('close', resolve);
      busboy.once('error', cancel);
      source.once('error', cancel);
      source.pipe(busboy);
    });
  } catch (error) {
    parseError = error;
  }
  await Promise.all(tasks);

  const error = failure ?? parseError;
  const files = slots.filter(
    (file): file is UploadedMultipartFile => file !== undefined,
  );
  if (error !== undefined) {
    await removeFiles(storage, request, files);
    throw transformException(error);
  }

  switch (spec.strategy) {
    case 'VALUE': {
      [request.file] = files;
      break;
    }
    case 'ARRAY': {
      request.files = files;
      break;
    }
    case 'OBJECT': {
      const grouped: Record<string, UploadedMultipartFile[]> =
        Object.create(null);
      for (const file of files) {
        (grouped[file.fieldname] ??= []).push(file);
      }
      request.files = grouped;
      break;
    }
    case 'NONE':
    default: {
      break;
    }
  }
  request.body = body;
}

export {
  processMultipart,
  resolveStorage,
  validateLimits,
  type FileStrategy,
  type UploadSpec,
};
