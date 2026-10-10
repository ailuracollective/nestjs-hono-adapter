import type { Bindings } from '../src/core/bindings.ts';

/**
 * The native server an in-process request is run with. Nothing
 * on that path upgrades a WebSocket or asks for a client
 * address, so every member answers the nothing it has to say.
 */
const SYNTHETIC_SERVER = {
  hostname: undefined,
  port: undefined,
  protocol: 'http',
  // Bun's `requestIP` answers null when it cannot read an address.
  // oxlint-disable-next-line unicorn/no-null
  requestIP: (): null => null,
  stop: (): Promise<void> => Promise.resolve(),
  upgrade: (): boolean => false,
} satisfies Bindings['server'];

export { SYNTHETIC_SERVER };
