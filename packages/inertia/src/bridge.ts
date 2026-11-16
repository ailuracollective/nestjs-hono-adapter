import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchAdapter } from './adapter.ts';
import { inertiaPeer } from './peer.ts';
import { fitSurface } from './surface.ts';
import { assertInertiaVersion } from './version.ts';

const bridge: Bridge = {
  install: async (target) => {
    const peer = await inertiaPeer();
    if (peer === undefined) return;
    assertInertiaVersion(peer.VERSION);
    patchAdapter(target.adapter);
    fitSurface(target);
  },
  name: 'inertia',
};

export { bridge };
