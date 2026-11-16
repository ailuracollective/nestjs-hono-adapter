import { candidates } from './peer-resolution.ts';

/** What a deployment declared, by the specifier it named. */
const declared = new Map<string, unknown>();

const tryImport = async (candidate: string): Promise<unknown> => {
  try {
    return await import(candidate);
  } catch {
    return undefined;
  }
};

/**
 * Declares what a specifier names, for a runtime that resolves none — a compiled executable, or a
 * Worker. `loadPeer` answers the declaration ahead of any resolution.
 */
function registerPeer(specifier: string, peer: unknown): void {
  declared.set(specifier, peer);
}

/** Forgets every declaration, so the runtime's own resolution answers again. */
function clearPeers(): void {
  declared.clear();
}

/**
 * Loads one optional peer, treating an absent one as an absent capability: the first candidate that
 * loads is the answer.
 */
const loadPeer = async (specifier: string): Promise<unknown> => {
  if (declared.has(specifier)) return declared.get(specifier);
  const loaded = await Promise.all(candidates(specifier).map((one) => tryImport(one)));
  return loaded.find((one) => one !== undefined);
};

export { clearPeers, loadPeer, registerPeer };
