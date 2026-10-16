import type { Readable } from 'node:stream';

interface UploadedMultipartFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

interface IncomingMultipartFile {
  readonly fieldname: string;
  readonly originalname: string;
  readonly encoding: string;
  readonly mimetype: string;
  readonly stream: Readable;
  path?: string;
}

interface MultipartFileStream {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  stream: Readable;
}

export type { IncomingMultipartFile, MultipartFileStream, UploadedMultipartFile };
