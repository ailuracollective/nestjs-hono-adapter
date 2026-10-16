import type { IncomingMultipartFile, UploadedMultipartFile } from './multipart-file.interface.ts';

interface MultipartStorageEngine {
  _handleFile: (
    request: unknown,
    file: IncomingMultipartFile,
    callback: (error?: unknown, info?: Partial<UploadedMultipartFile>) => void,
  ) => void;
  _removeFile: (
    request: unknown,
    file: UploadedMultipartFile,
    callback: (error: Error | null) => void,
  ) => void;
}

interface MultipartLimits {
  fieldNameSize?: number;
  fieldSize?: number;
  fields?: number;
  fileSize?: number;
  files?: number;
  parts?: number;
  headerPairs?: number;
}

interface MultipartOptions {
  dest?: string;
  storage?: MultipartStorageEngine;
  limits?: MultipartLimits | ((request: unknown) => MultipartLimits);
  preservePath?: boolean;
  defParamCharset?: string;
  fileFilter?: (
    request: unknown,
    file: IncomingMultipartFile,
    callback: (error: Error | null, accept: boolean) => void,
  ) => void;
}

interface MultipartField {
  name: string;
  maxCount?: number;
}

export type { MultipartField, MultipartLimits, MultipartOptions, MultipartStorageEngine };
