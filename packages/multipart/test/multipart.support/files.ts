import type {
  MultipartOptions,
  UploadedMultipartFile,
} from '#multipart/index';

/** What one upload is reported as. */
interface FileSummary {
  /** The name the client sent. */
  originalname: string;
  /** The type the client declared. */
  mimetype: string;
  /** The size in bytes. */
  size: number;
  /** Whether the file was buffered. */
  buffered: boolean;
}

/** Summarizes one uploaded file for an answer. */
const summarize = (
  file: UploadedMultipartFile | undefined,
): FileSummary | undefined => {
  if (file === undefined) {
    return undefined;
  }
  return {
    buffered: file.buffer !== undefined,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size,
  };
};

/** Accepts a text part and skips anything else. */
/* oxlint-disable promise/prefer-await-to-callbacks, unicorn/no-null -- multer's fileFilter answers through the callback it is handed and spells "no error" as null, so a case that drives it cannot be written without either. */
const textOnly: NonNullable<MultipartOptions['fileFilter']> = (
  _request,
  file,
  callback,
) => {
  callback(null, file.mimetype === 'text/plain');
};
/* oxlint-enable promise/prefer-await-to-callbacks, unicorn/no-null */

export { summarize, textOnly };
