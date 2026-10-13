import { multerExceptions } from './multipart.constants.ts';
import type { MultipartErrorCode } from './multipart.constants.ts';

/**
 * A failure multer would report, carried as an `Error` until
 * the exception layer maps it to the HTTP status multer gives
 * it.
 */
class MultipartError extends Error {
  public readonly code: MultipartErrorCode;
  public readonly field: string | undefined;

  public constructor(code: MultipartErrorCode, field?: string) {
    super(multerExceptions[code]);
    this.name = 'MultipartError';
    this.code = code;
    this.field = field;
  }
}

export { MultipartError };
