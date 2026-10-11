/**
 * The upload island: the interceptors and storage engines that
 * parse a `multipart/form-data` body into `req.file`,
 * `req.files` and `req.body` with multer's semantics, behind
 * the `./multipart` subpath.
 *
 * It is the one place in the package that may consume a
 * multipart body, and the one place that depends on a parser
 * (`busboy`). Importing it is what marks the adapter, so a
 * deployment that serves no upload never loads either.
 */
export {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
  NoFilesInterceptor,
} from './interceptors/index.ts';
export type {
  MultipartModuleAsyncOptions,
  MultipartModuleOptions,
  MultipartOptionsFactory,
} from './interfaces/index.ts';
export { MultipartModule } from './multipart.module.ts';
export {
  diskStorage,
  memoryStorage,
  type DiskStorageOptions,
} from './storage/index.ts';
export type {
  IncomingMultipartFile,
  MultipartField,
  MultipartLimits,
  MultipartOptions,
  MultipartStorageEngine,
  UploadedMultipartFile,
} from './interfaces/index.ts';
