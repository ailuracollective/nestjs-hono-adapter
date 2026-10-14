import { multerExceptions } from './multipart.constants.ts';
import type { MultipartErrorCode } from './multipart.constants.ts';

/** A failure multer would report. */
class MultipartError extends Error {
  /** The multer code the failure carries. */
  public readonly code: MultipartErrorCode;
  /** The field the failure names, if any. */
  public readonly field: string | undefined;

  /** Builds the failure for one multer code. */
  public constructor(code: MultipartErrorCode, field?: string) {
    super(multerExceptions[code]);
    this.name = 'MultipartError';
    this.code = code;
    this.field = field;
  }
}

export { MultipartError };
