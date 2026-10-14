import type {
  IncomingMultipartFile,
  UploadedMultipartFile,
} from './multipart-file.interface.ts';

/** Multer's storage engine contract. */
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

/** The size limits, with multer's keys and meaning. */
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

/** The options one interceptor accepts. */
interface MultipartOptions {
  /** Where files are written, when no `storage` is named. */
  dest?: string;
  /** The storage engine, memory by default. */
  storage?: MultipartStorageEngine;
  /** The size limits, or a function of the request. */
  limits?:
    | MultipartLimits
    | ((request: unknown) => MultipartLimits);
  /** Keep the whole path a file arrived with. */
  preservePath?: boolean;
  /** Character set for the part headers, latin1 by default. */
  defParamCharset?: string;
  /** Decides what is stored. */
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
