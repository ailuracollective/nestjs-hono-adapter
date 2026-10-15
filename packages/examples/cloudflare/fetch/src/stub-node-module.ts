import * as nodeModule from 'module';

/** A `createRequire` that tolerates a missing `import.meta.url`. */
export const createRequire = (
  filename?: string | URL,
): ReturnType<typeof nodeModule.createRequire> => {
  return nodeModule.createRequire(filename ?? 'file:///worker.js');
}
