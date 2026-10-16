import { candidates } from './peer-resolution.ts';

const tryImport = async (candidate: string): Promise<unknown> => {
  try {
    return await import(candidate);
  } catch {
    return undefined;
  }
};

/**
 * Loads one optional peer, treating an absent one as an absent capability: the first candidate that
 * loads is the answer.
 */
const loadPeer = async (specifier: string): Promise<unknown> => {
  const loaded = await Promise.all(candidates(specifier).map((one) => tryImport(one)));
  return loaded.find((one) => one !== undefined);
};

export { loadPeer };
