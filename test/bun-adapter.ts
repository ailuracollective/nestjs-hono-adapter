import { bunServer } from '#adapter/servers/bun';
import { ServerAdapter } from '#adapter/index';
import type { ServerAdapterOptions } from '#adapter/index';

/** The options an adapter takes once its transport is supplied. */
type AdapterOptions = Omit<ServerAdapterOptions, 'transport'>;

/** A `ServerAdapter` bound to the Bun transport. */
const bunAdapter = (
  options: AdapterOptions = {},
): ServerAdapter =>
  new ServerAdapter(
    Object.assign({}, options, { transport: bunServer() }),
  );

export { bunAdapter };
export type { AdapterOptions };
