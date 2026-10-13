/**
 * The codes and messages multer raises, copied from
 * `@nestjs/platform-express` so a client sees the same answer
 * from this adapter and from the platform one.
 */
const multerExceptions = {
  LIMIT_PART_COUNT: 'Too many parts',
  LIMIT_FILE_SIZE: 'File too large',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_FIELD_KEY: 'Field name too long',
  LIMIT_FIELD_VALUE: 'Field value too long',
  LIMIT_FIELD_COUNT: 'Too many fields',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
  MISSING_FIELD_NAME: 'Field name missing',
  INVALID_FIELD_NAME: 'Invalid field name',
  LIMIT_FIELD_NESTING: 'Field name nesting too deep',
} as const;

type MultipartErrorCode = keyof typeof multerExceptions;

/**
 * The busboy messages this adapter reports, in the spelling
 * multer reports them with.
 */
const busboyExceptions = {
  MULTIPART_BOUNDARY_NOT_FOUND: 'Multipart: Boundary not found',
  MULTIPART_UNEXPECTED_END_OF_FORM:
    'Multipart: Unexpected end of form',
} as const;

/**
 * Reported when an upload interceptor runs on an adapter that
 * is not this package's, as
 * `@nestjs/platform-fastify/multipart` reports a Fastify
 * adapter it was not written for.
 */
const WRONG_ADAPTER_MESSAGE =
  'File upload interceptors need the Hono adapter from "@ailura/nestjs-hono-adapter".';

export {
  busboyExceptions,
  multerExceptions,
  WRONG_ADAPTER_MESSAGE,
};
export type { MultipartErrorCode };
