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

export type { IncomingMultipartFile, UploadedMultipartFile };
