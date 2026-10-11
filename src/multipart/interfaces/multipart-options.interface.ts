import type {
  IncomingMultipartFile,
  UploadedMultipartFile,
} from './multipart-file.interface.ts';

/**
 * Multer's storage engine contract, kept as-is so a storage
 * engine written for `@nestjs/platform-express` can be handed
 * to an interceptor here unchanged.
 */
interface MultipartStorageEngine {
  _handleFile: (
    request: unknown,
    file: IncomingMultipartFile,
    callback: (
      error?: unknown,
      info?: Partial<UploadedMultipartFile>,
    ) => void,
  ) => void;
  _removeFile: (
    request: unknown,
    file: UploadedMultipartFile,
    callback: (error: Error | null) => void,
  ) => void;
}

/**
 * The same keys and meaning as multer's `MulterLimits`, so a
 * limits object moves between the two adapters unchanged.
 */
interface MultipartLimits {
  /** Largest field name, in bytes. */
  fieldNameSize?: number;
  /** Largest field value, in bytes. */
  fieldSize?: number;
  /** Most non-file fields. */
  fields?: number;
  /** Largest file, in bytes. */
  fileSize?: number;
  /** Most file fields. */
  files?: number;
  /** Most parts, fields and files together. */
  parts?: number;
  /** Most header key/value pairs per part. */
  headerPairs?: number;
}

/**
 * The options one interceptor accepts, with the same keys and
 * meaning as `@nestjs/platform-express`'s `MulterOptions`, so
 * an options object moves between the two unchanged.
 */
interface MultipartOptions {
  /** Where files are written, when no `storage` is named. */
  dest?: string;
  /** The storage engine, memory by default. */
  storage?: MultipartStorageEngine;
  /**
   * The size limits, or a function of the request answering
   * them.
   */
  limits?:
    | MultipartLimits
    | ((request: unknown) => MultipartLimits);
  /**
   * Keep the whole path a file arrived with, rather than its
   * basename.
   */
  preservePath?: boolean;
  /** Character set for the part headers, latin1 by default. */
  defParamCharset?: string;
  /**
   * Decides what is stored: answer `false` to skip a file, or
   * an error to fail the request.
   */
  fileFilter?: (
    request: unknown,
    file: IncomingMultipartFile,
    callback: (error: Error | null, accept: boolean) => void,
  ) => void;
}

/** One field an upload accepts, with an optional ceiling. */
interface MultipartField {
  /** The field name. */
  name: string;
  /** Most files this field accepts. */
  maxCount?: number;
}

export type {
  MultipartField,
  MultipartLimits,
  MultipartOptions,
  MultipartStorageEngine,
};
