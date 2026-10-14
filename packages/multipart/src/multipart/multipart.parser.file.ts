import type {
  IncomingMultipartFile,
  MultipartOptions,
  MultipartStorageEngine,
  UploadedMultipartFile,
} from '#multipart/interfaces/index';
import { MultipartError } from './multipart.error.ts';
import type { Truncatable } from './multipart.parser.fields.ts';
import {
  applyFileFilter,
  decodeFormDataName,
  removeFiles,
  storeFile,
} from './multipart.parser.fields.ts';

/** Stores one file and answers the shape multer gives it. */
const handleFile = async (
  name: string,
  stream: Truncatable,
  info: {
    filename?: string | undefined;
    encoding: string;
    mimeType: string;
  },
  options: MultipartOptions,
  request: unknown,
  storage: MultipartStorageEngine,
): Promise<UploadedMultipartFile | undefined> => {
  const originalname = info.filename ?? '';
  if (originalname === '') {
    stream.resume();
    return undefined;
  }
  const file: IncomingMultipartFile = {
    encoding: info.encoding,
    fieldname: name,
    mimetype: info.mimeType,
    originalname: decodeFormDataName(originalname),
    stream,
  };
  if (!(await applyFileFilter(options, request, file))) {
    stream.resume();
    return undefined;
  }
  const stored = await storeFile(storage, request, file);
  const uploaded: UploadedMultipartFile = Object.assign(
    {
      encoding: file.encoding,
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: 0,
    },
    stored,
  );
  if (stream.truncated === true) {
    await removeFiles(storage, request, [uploaded]);
    throw new MultipartError('LIMIT_FILE_SIZE', name);
  }
  return uploaded;
};

export { handleFile };
