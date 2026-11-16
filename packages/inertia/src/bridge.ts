import { loadPeer } from '@ailura/nestjs-hono-adapter';
import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchServerAdapter } from './patch-server.ts';
import { fitSurface } from './surface.ts';
import { assertInertiaVersion } from './version.ts';

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

const bridge: Bridge = {
  install: async (target) => {
    const peer = await inertiaPeer();
    if (peer === undefined) return;
    assertInertiaVersion(peer.VERSION);
    patchServerAdapter(target.adapter);
    fitSurface(target);
  },
  name: 'inertia',
};

export { bridge };
