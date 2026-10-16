import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Readable } from 'node:stream';

import type { NestContext, NestRequest } from '@ailura/nestjs-hono-adapter';
import type {
  IncomingMultipartFile,
  MultipartFileStream,
  MultipartOptions,
} from '#multipart/interfaces/index';
import { busboyExceptions, multerExceptions } from './multipart.constants.ts';
import { MultipartError } from './multipart.error.ts';
import {
  appendTextField,
  applyFileFilter,
  configFor,
  createBusboy,
  decodeFormDataName,
  isMultipart,
} from './multipart.parser.fields.ts';
import { resolveLimits } from './multipart.parser.limits.ts';
import { drainBody, pending } from './multipart.parser.pending.ts';
import { transformException } from './multipart.utils.ts';

interface StreamParse {
  file: MultipartFileStream | undefined;
  drain: () => Promise<void>;
}

const processStream = async (
  context: NestContext,
  request: NestRequest,
  fieldName: string,
  options: MultipartOptions,
): Promise<StreamParse | undefined> => {
  const contentType = context.req.header('content-type') ?? '';
  if (!isMultipart(contentType)) {
    return undefined;
  }
  const web = context.req.raw.body;
  if (web === null)
    throw new BadRequestException(busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FORM);

  const limits = resolveLimits(request, options);
  const busboy = createBusboy(configFor(contentType, limits, options));
  const source = Readable.fromWeb(web as unknown as Parameters<typeof Readable.fromWeb>[0]);
  const body: Record<string, unknown> = Object.create(null);
  request.body = body;
  request.file = undefined;
  request.files = undefined;

  const ready = pending();
  let handed: MultipartFileStream | undefined = undefined;
  let taken = false;
  let failure: unknown = undefined;

  const fail = (error: unknown): void => {
    if (failure !== undefined) return;
    failure = error;
    if (handed !== undefined && !handed.stream.destroyed)
      handed.stream.destroy(error instanceof Error ? error : new Error(String(error)));
    ready.reject(error);
  };

  const handOver = async (
    name: string,
    stream: Readable & { truncated?: boolean },
    info: {
      filename?: string | undefined;
      encoding: string;
      mimeType: string;
    },
  ): Promise<void> => {
    const originalname = info.filename ?? '';
    if (originalname === '') {
      taken = false;
      stream.resume();
      return;
    }
    const file: IncomingMultipartFile = {
      encoding: info.encoding,
      fieldname: name,
      mimetype: info.mimeType,
      originalname: decodeFormDataName(originalname),
      stream,
    };
    if (!(await applyFileFilter(options, request, file))) {
      taken = false;
      stream.resume();
      return;
    }
    const refuse = (): void => {
      stream.destroy(new PayloadTooLargeException(multerExceptions.LIMIT_FILE_SIZE));
    };
    if (stream.truncated === true) {
      refuse();
    } else {
      stream.once('limit', refuse);
    }
    handed = {
      encoding: file.encoding,
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname,
      stream,
    };
    request.file = handed;
    ready.resolve();
  };

  busboy.on('field', (name, value, info) => {
    if (taken || failure !== undefined) return;
    try {
      appendTextField(body, name, value, info, limits);
    } catch (error: unknown) {
      fail(error);
    }
  });

  busboy.on('file', (name, stream, info) => {
    if (taken || failure !== undefined) {
      stream.resume();
      return;
    }
    if (name !== fieldName) {
      stream.resume();
      fail(new MultipartError('LIMIT_UNEXPECTED_FILE', name));
      return;
    }
    taken = true;
    void handOver(name, stream, info).catch(fail);
  });

  busboy.on('partsLimit', () => {
    fail(new MultipartError('LIMIT_PART_COUNT'));
  });
  busboy.on('filesLimit', () => {
    fail(new MultipartError('LIMIT_FILE_COUNT'));
  });
  busboy.on('fieldsLimit', () => {
    fail(new MultipartError('LIMIT_FIELD_COUNT'));
  });
  busboy.once('close', () => {
    ready.resolve();
  });
  busboy.once('error', fail);
  source.once('error', fail);

  source.pipe(busboy);

  let drain: Promise<void> | undefined = undefined;
  const discard = (): Promise<void> => {
    drain ??= drainBody(source, busboy);
    return drain;
  };

  try {
    await ready.promise;
  } catch (error: unknown) {
    await discard();
    throw transformException(error);
  }
  return { drain: discard, file: handed };
};

export { processStream };
export type { StreamParse };
