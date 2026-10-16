import { tmpdir } from 'node:os';
import path from 'node:path';

const CREATED = 201;
const BAD_REQUEST = 400;
const TOO_LARGE = 413;
const LIMIT = 4;
const OVER_LIMIT = 'too long';
const DISK_CONTENT = 'on disk';
const MAX_FILES = 3;
const GALLERY = 2;

const FORBIDDEN_FIELD = '__proto__';

const POLLUTED = 'polluted';

const NESTED_FORBIDDEN = 'nested[__proto__]';

const directory = path.join(tmpdir(), 'hono-upload-adapter-test');

const abortDirectory = path.join(tmpdir(), 'hono-upload-adapter-abort-test');

const ABORT_DEADLINE = 2000;

export {
  ABORT_DEADLINE,
  abortDirectory,
  BAD_REQUEST,
  CREATED,
  DISK_CONTENT,
  FORBIDDEN_FIELD,
  GALLERY,
  LIMIT,
  MAX_FILES,
  NESTED_FORBIDDEN,
  OVER_LIMIT,
  POLLUTED,
  TOO_LARGE,
  directory,
};
