import { ROOT_VIEW } from '@ailura/examples-shared';

// A Worker has no filesystem: the root view the stock renderer reads is the inlined module.
const read = (path: string): string => {
  if (path.endsWith('.html')) return ROOT_VIEW;
  throw new Error(`The Worker bundles no file at ${path}`);
};

const readFileSync = (path: string): string => read(String(path));
const readFile = (path: string): Promise<string> => Promise.resolve(read(String(path)));

export { readFile, readFileSync };
