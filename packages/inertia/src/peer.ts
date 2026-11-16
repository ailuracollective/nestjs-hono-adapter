import { loadPeer } from '@ailura/nestjs-hono-adapter';

const PEER = '@dudousxd/nestjs-inertia';

interface InertiaPeer {
  readonly VERSION: string;
}

const isPeer = (value: unknown): value is InertiaPeer => {
  if (typeof value !== 'object' || value === null) return false;
  const version: unknown = Reflect.get(value, 'VERSION');
  return typeof version === 'string';
};

const inertiaPeer = async (): Promise<InertiaPeer | undefined> => {
  const loaded = await loadPeer(PEER);
  return isPeer(loaded) ? loaded : undefined;
};

export { inertiaPeer };
export type { InertiaPeer };
