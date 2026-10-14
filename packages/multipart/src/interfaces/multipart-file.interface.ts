import type { Readable } from 'node:stream';

/** A stored upload in the shape multer gives one. */
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

/** What a storage engine and `fileFilter` see before storing. */
interface IncomingMultipartFile {
  readonly fieldname: string;
  readonly originalname: string;
  readonly encoding: string;
  readonly mimetype: string;
  /** The bytes of the part. */
  readonly stream: Readable;
  /** The path disk storage writes to. */
  path?: string;
}

/** The file a streaming interceptor hands to the handler. */
interface MultipartFileStream {
  /** Field name the file arrived under. */
  fieldname: string;
  /** Name of the file on the client, as sent. */
  originalname: string;
  /** The transfer encoding the part declared. */
  encoding: string;
  /** The media type the part declared. */
  mimetype: string;
  /** The bytes of the part, live from the request. */
  stream: Readable;
}

export type {
  IncomingMultipartFile,
  MultipartFileStream,
  UploadedMultipartFile,
};
