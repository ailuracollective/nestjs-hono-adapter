import type {
  MultipartField,
  MultipartLimits,
  MultipartOptions,
  MultipartStorageEngine,
} from '#multipart/interfaces/index';
import {
  diskStorage,
  memoryStorage,
} from '#multipart/storage/index';

/** Where accepted files end up. */
type FileStrategy = 'VALUE' | 'ARRAY' | 'OBJECT' | 'NONE';

/** What one interceptor accepts, and where the files go. */
interface UploadSpec {
  /** Accepted fields, or `'ANY'` for every field. */
  fields: MultipartField[] | 'ANY';
  strategy: FileStrategy;
}

/** The storage a request uses. */
const resolveStorage = (
  options: MultipartOptions,
): MultipartStorageEngine => {
  if (options.storage !== undefined) {
    return options.storage;
  }
  if (options.dest !== undefined) {
    return diskStorage({ destination: options.dest });
  }
  return memoryStorage();
};

/**
 * Rejects a limit that is not a non-negative integer or
 * `Infinity`.
 */
const validateLimits = (
  limits: MultipartLimits | undefined,
): void => {
  for (const [key, value] of Object.entries(limits ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (
      (Number.isInteger(value) && value >= 0) ||
      value === Infinity
    ) {
      continue;
    }
    throw new TypeError(
      `Expected limits.${key} to be a non-negative integer or Infinity`,
    );
  }
};

/** The limits for one request, resolved from the options. */
const resolveLimits = (
  request: unknown,
  options: MultipartOptions,
): MultipartLimits | undefined => {
  const { limits } = options;
  if (typeof limits !== 'function') {
    validateLimits(limits);
    return limits;
  }
  const resolved = limits(request);
  validateLimits(resolved);
  return resolved;
};

export { resolveLimits, resolveStorage, validateLimits };
export type { FileStrategy, UploadSpec };
