import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';

import type {
  NestContext,
  NestRequest,
} from '@ailura/nestjs-hono-adapter';
import type {
  MultipartOptions,
  MultipartStorageEngine,
  UploadedMultipartFile,
} from '#multipart/interfaces/index';
import { busboyExceptions } from './multipart.constants.ts';
import { MultipartError } from './multipart.error.ts';
import { handleFile } from './multipart.parser.file.ts';
import {
  appendTextField,
  configFor,
  createBusboy,
  isMultipart,
  removeFiles,
} from './multipart.parser.fields.ts';
import type { UploadSpec } from './multipart.parser.limits.ts';
import { resolveLimits } from './multipart.parser.limits.ts';
import { transformException } from './multipart.utils.ts';

/**
 * Parses a multipart body into `req.body`, `req.file` and
 * `req.files`.
 */
const processMultipart = async (
  context: NestContext,
  request: NestRequest,
  spec: UploadSpec,
  options: MultipartOptions,
  storage: MultipartStorageEngine,
): Promise<void> => {
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
};

export { processMultipart };
