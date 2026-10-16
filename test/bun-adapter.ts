import { bunServer } from '#adapter/servers/bun';
import { ServerAdapter } from '#adapter/index';
import type { ServerAdapterOptions } from '#adapter/index';

type AdapterOptions = Omit<ServerAdapterOptions, 'transport'>;

const bunAdapter = (options: AdapterOptions = {}): ServerAdapter =>
  new ServerAdapter(Object.assign({}, options, { transport: bunServer() }));

export { bunAdapter };
export type { AdapterOptions };
