import type {
  MultipartField,
  MultipartLimits,
  MultipartOptions,
  MultipartStorageEngine,
} from '#multipart/interfaces/index';
import { diskStorage, memoryStorage } from '#multipart/storage/index';

type FileStrategy = 'VALUE' | 'ARRAY' | 'OBJECT' | 'NONE';

interface UploadSpec {
  fields: MultipartField[] | 'ANY';
  strategy: FileStrategy;
}

const resolveStorage = (options: MultipartOptions): MultipartStorageEngine => {
  if (options.storage !== undefined) return options.storage;
  if (options.dest !== undefined) {
    return diskStorage({ destination: options.dest });
  }
  return memoryStorage();
};

const validateLimits = (limits: MultipartLimits | undefined): void => {
  for (const [key, value] of Object.entries(limits ?? {})) {
    if (value === undefined) continue;
    if ((Number.isInteger(value) && value >= 0) || value === Infinity) {
      continue;
    }
    throw new TypeError(`Expected limits.${key} to be a non-negative integer or Infinity`);
  }
};

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
