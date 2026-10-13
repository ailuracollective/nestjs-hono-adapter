import type { Readable } from 'node:stream';

/**
 * A stored upload, in the shape multer gives one, so
 * `@UploadedFile()`, `ParseFilePipe` and the built-in file
 * validators work unchanged. Memory storage sets `buffer`; disk
 * storage sets `destination`, `filename` and `path`.
 */
interface UploadedMultipartFile {
  /** Field name the file arrived under. */
  fieldname: string;
  /** Name of the file on the client, as sent. */
  originalname: string;
  /** The transfer encoding the part declared. */
  encoding: string;
  /** The media type the part declared. */
  mimetype: string;
  /** The number of bytes stored. */
  size: number;
  /** The whole file, when memory storage kept it. */
  buffer?: Buffer;
  /** The folder the file was written to, on disk storage. */
  destination?: string;
  /** The name the file was written under, on disk storage. */
  filename?: string;
  /** The path the file was written to, on disk storage. */
  path?: string;
}

/**
 * What a storage engine and `fileFilter` see before the file is
 * stored: the part's metadata and the stream of its bytes.
 */
interface IncomingMultipartFile {
  readonly fieldname: string;
  readonly originalname: string;
  readonly encoding: string;
  readonly mimetype: string;
  /**
   * The bytes of the part. Meant to be consumed by
   * `MultipartStorageEngine._handleFile` only.
   */
  readonly stream: Readable;
  /**
   * The path disk storage writes to, set before the write so a
   * failed write can remove it. multer's incoming file carries
   * it for the same reason.
   */
  path?: string;
}

/**
 * The file `FileStreamInterceptor` hands to the route handler
 * instead of storing it: the part's metadata and the stream of
 * its bytes, live from the request. Nothing reads those bytes
 * until the handler does, and whatever the handler leaves
 * unread is discarded once it has answered, so the client can
 * finish uploading.
 *
 * The size is not known when the handler runs, so the file
 * validators that need the whole file — `MaxFileSizeValidator`
 * and the magic-number check of `FileTypeValidator` — do not
 * apply to it.
 */
interface MultipartFileStream {
  /** Field name the file arrived under. */
  fieldname: string;
  /** Name of the file on the client, as sent. */
  originalname: string;
  /** The transfer encoding the part declared. */
  encoding: string;
  /** The media type the part declared. */
  mimetype: string;
  /**
   * The bytes of the part, live from the request. Errors with a
   * `PayloadTooLargeException` once `limits.fileSize` is
   * passed.
   */
  stream: Readable;
}

export type {
  IncomingMultipartFile,
  MultipartFileStream,
  UploadedMultipartFile,
};
