import Busboy from 'busboy';
import type { BusboyConfig } from 'busboy';
import type { Readable } from 'node:stream';

import type {
  IncomingMultipartFile,
  MultipartLimits,
  MultipartOptions,
  MultipartStorageEngine,
  UploadedMultipartFile,
} from '#multipart/interfaces/index';
import { appendField } from './append-field.util.ts';
import { MultipartError } from './multipart.error.ts';
import { transformException } from './multipart.utils.ts';

type Truncatable = Readable & { truncated?: boolean };

const isMultipart = (contentType: string): boolean =>
  contentType.toLowerCase().startsWith('multipart/form-data');

const decodeFormDataName = (name: string): string =>
  name.replaceAll(/%0A|%0D|%22/giu, (match) => {
    switch (match.toUpperCase()) {
      case '%0A':
        return '\n';
      case '%0D':
        return '\r';
      default:
        return '"';
    }
  });

const checkFieldNameSize = (rawName: string, limits: MultipartLimits | undefined): void => {
  if (typeof limits?.fieldNameSize === 'number' && rawName.length > limits.fieldNameSize)
    throw new MultipartError('LIMIT_FIELD_KEY');
};

const appendTextField = (
  body: Record<string, unknown>,
  rawName: string,
  value: string,
  info: { nameTruncated: boolean; valueTruncated: boolean },
  limits: MultipartLimits | undefined,
): void => {
  const name = decodeFormDataName(rawName);
  if (info.nameTruncated) throw new MultipartError('LIMIT_FIELD_KEY');
  if (info.valueTruncated) throw new MultipartError('LIMIT_FIELD_VALUE', name);
  checkFieldNameSize(rawName, limits);
  if (!appendField(body, name, value)) {
    throw new MultipartError('INVALID_FIELD_NAME', name);
  }
};

const applyFileFilter = (
  options: MultipartOptions,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<boolean> => {
  const { fileFilter } = options;
  if (fileFilter === undefined) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    fileFilter(request, file, (error: Error | null | undefined, accept) => {
      if (error === null || error === undefined) {
        resolve(accept);
      } else {
        reject(error);
      }
    });
  });
};

const storeFile = (
  storage: MultipartStorageEngine,
  request: unknown,
  file: IncomingMultipartFile,
): Promise<Partial<UploadedMultipartFile>> =>
  new Promise((resolve, reject) => {
    storage._handleFile(request, file, (error, info) => {
      if (error === undefined || error === null) {
        resolve(info ?? {});
      } else {
        reject(error);
      }
    });
  });

const removeFiles = (
  storage: MultipartStorageEngine,
  request: unknown,
  files: UploadedMultipartFile[],
): Promise<void> =>
  Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve) => {
          storage._removeFile(request, file, () => {
            resolve();
          });
        }),
    ),
  ).then(() => undefined);

const configFor = (
  contentType: string,
  limits: MultipartLimits | undefined,
  options: MultipartOptions,
): BusboyConfig => {
  const config: BusboyConfig = {
    defParamCharset: options.defParamCharset ?? 'latin1',
    headers: { 'content-type': contentType },
    preservePath: options.preservePath ?? false,
  };
  if (limits !== undefined) config.limits = limits;
  return config;
};

const createBusboy = (config: BusboyConfig): ReturnType<typeof Busboy> => {
  try {
    return Busboy(config);
  } catch (error: unknown) {
    throw transformException(error);
  }
};

export {
  appendTextField,
  applyFileFilter,
  configFor,
  createBusboy,
  decodeFormDataName,
  isMultipart,
  removeFiles,
  storeFile,
};
export type { Truncatable };
