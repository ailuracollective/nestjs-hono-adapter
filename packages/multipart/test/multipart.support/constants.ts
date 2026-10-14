import { tmpdir } from 'node:os';
import path from 'node:path';

/** The status a created upload answers with. */
const CREATED = 201;
/** The status a refused body answers with. */
const BAD_REQUEST = 400;
/** The status an over-limit upload answers with. */
const TOO_LARGE = 413;
/** The file size limit a route sets, in bytes. */
const LIMIT = 4;
/** Content longer than the limit. */
const OVER_LIMIT = 'too long';
/** Content written to disk. */
const DISK_CONTENT = 'on disk';
/** How many files the many-file route accepts. */
const MAX_FILES = 3;
/** How many gallery files the fields route accepts. */
const GALLERY = 2;

/** The field name that would reach the prototype chain. */
const FORBIDDEN_FIELD = '__proto__';

/** The value a polluted object would answer with. */
const POLLUTED = 'polluted';

/** A nested name whose second step reaches the same chain. */
const NESTED_FORBIDDEN = 'nested[__proto__]';

/** Where disk storage writes, created by the engine itself. */
const directory = path.join(
  tmpdir(),
  'hono-upload-adapter-test',
);

/** Where an aborted upload writes. */
const abortDirectory = path.join(
  tmpdir(),
  'hono-upload-adapter-abort-test',
);

/** How long an aborted upload may take before it is hung. */
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
