import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

import type {
  MultipartModuleOptions,
  MultipartOptions,
} from '#multipart/interfaces/index';
import { busboyExceptions } from './multipart.constants.ts';
import { MultipartError } from './multipart.error.ts';

/** Whether a value is a plain object, which is not an array. */
const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return !Array.isArray(value);
};

/** Says whether a value is a Nest HTTP exception, across copies. */
const isHttpException = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getStatus') === 'function';

/** Says whether a value is a file Nest built, across copies. */
const isStreamableFile = (
  value: unknown,
): value is { getStream: () => unknown } =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getStream') === 'function';

/** Merges the module's options with an interceptor's. */
const mergeOptions = (
  moduleOptions: MultipartModuleOptions,
  localOptions: MultipartOptions,
): MultipartModuleOptions => {
  const merged: MultipartModuleOptions = {
    ...moduleOptions,
    ...localOptions,
  };
  if (
    isPlainObject(moduleOptions.limits) &&
    isPlainObject(localOptions.limits)
  ) {
    merged.limits = {
      ...moduleOptions.limits,
      ...localOptions.limits,
    };
  }
  return merged;
};

/** Maps a parser failure to the HTTP exception multer gives. */
const transformException = (error: unknown): unknown => {
  if (error === undefined || isHttpException(error)) {
    return error;
  }
  if (error instanceof MultipartError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new PayloadTooLargeException(error.message);
    }
    const message =
      error.field === undefined
        ? error.message
        : `${error.message} - ${error.field}`;
    return new BadRequestException(message);
  }
  if (error instanceof Error) {
    const { message } = error;
    if (message.includes('Boundary not found')) {
      return new BadRequestException(
        busboyExceptions.MULTIPART_BOUNDARY_NOT_FOUND,
      );
    }
    if (
      message.includes('Unexpected end of form') ||
      message.includes('Unexpected end of file') ||
      message.includes('Malformed part header')
    ) {
      return new BadRequestException(
        busboyExceptions.MULTIPART_UNEXPECTED_END_OF_FORM,
      );
    }
  }
  return error;
};

export {
  isHttpException,
  isStreamableFile,
  mergeOptions,
  transformException,
};
