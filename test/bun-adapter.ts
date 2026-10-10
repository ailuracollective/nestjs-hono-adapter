import { bunServer } from '../src/servers/bun.ts';
import { ServerAdapter } from '../src/index.ts';
import type { ServerAdapterOptions } from '../src/index.ts';

/**
 * The options an adapter takes once its transport is supplied.
 * The transport is what a case varies only to exercise another
 * runtime, so the fixtures default to Bun.
 */
type AdapterOptions = Omit<ServerAdapterOptions, 'transport'>;

/** A `ServerAdapter` bound to the Bun transport. */
function bunAdapter(
  options: AdapterOptions = {},
): ServerAdapter {
  return new ServerAdapter(
    Object.assign({}, options, { transport: bunServer() }),
  );
}

export { bunAdapter };
export type { AdapterOptions };
