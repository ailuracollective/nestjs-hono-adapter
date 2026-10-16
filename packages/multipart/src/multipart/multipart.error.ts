import { multerExceptions } from './multipart.constants.ts';
import type { MultipartErrorCode } from './multipart.constants.ts';

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
