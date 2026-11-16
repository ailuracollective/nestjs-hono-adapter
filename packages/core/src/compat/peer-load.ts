import { candidates } from './peer-resolution.ts';

/**
 * What the application says a specifier names, for a runtime that answers no bare name: a Worker,
 * or a compiled executable.
 */
const declared = new Map<string, unknown>();

const tryImport = async (candidate: string): Promise<unknown> => {
  try {
    return await import(candidate);
  } catch {
    return undefined;
  }
};

/** Declares the peer a specifier names, ahead of what the runtime can resolve. */
const registerPeer = (specifier: string, peer: unknown): void => {
  if (peer !== undefined) declared.set(specifier, peer);
};

/**
 * Loads one optional peer, treating an absent one as an absent capability: a declared peer is the
 * answer, and otherwise the first candidate that loads is.
 */
const loadPeer = async (specifier: string): Promise<unknown> => {
  const peer = declared.get(specifier);
  if (peer !== undefined) return peer;
  const loaded = await Promise.all(candidates(specifier).map((one) => tryImport(one)));
  return loaded.find((one) => one !== undefined);
};

export { loadPeer, registerPeer };
