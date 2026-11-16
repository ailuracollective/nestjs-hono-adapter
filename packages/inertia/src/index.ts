import { patchConfigure } from './module-patch.ts';
import { guardPeer } from './peer.ts';

guardPeer();
patchConfigure();

export { bridge } from './bridge.ts';
