import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';

import type {
  MultipartModuleOptions,
  MultipartOptions,
} from '../interfaces/index.ts';
import { busboyExceptions } from './multipart.constants.ts';
import { MultipartError } from './multipart.error.ts';

/** Whether a value is a plain object, which is not an array. */
function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return !Array.isArray(value);
}

/**
 * Merges the module's options with an interceptor's, with the
 * same rule as the platform adapters: `limits` is merged key by
 * key when both sides name an object, and the local value wins
 * outright in every other case.
 */
function mergeOptions(
  moduleOptions: MultipartModuleOptions,
  localOptions: MultipartOptions,
): MultipartModuleOptions {
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
}

/**
 * Maps a parser failure to the HTTP exception multer would
 * produce: an oversized file is a `PayloadTooLargeException`,
 * every other parser error a `BadRequestException`, so a client
 * cannot tell this adapter from the platform one.
 */
function transformException(error: unknown): unknown {
  if (error === undefined || error instanceof HttpException) {
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
}

export { mergeOptions, transformException };
