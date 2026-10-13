import type { Transport } from './transport.ts';
import type { TransportOptions } from './hono-lifecycle.ts';

/**
 * The transport a deployment names.
 *
 * It is the half of `ServerAdapterOptions` that names no
 * feature, kept in a module of its own so a future option
 * crosses a seam of options rather than the whole adapter.
 * `core/server-adapter.ts` extends it with the view options,
 * which are the only part of that surface that reaches a
 * feature.
 */
interface TransportChoiceOptions extends Omit<
  TransportOptions,
  'transport'
> {
  /**
   * The runtime to serve through. Left out, the adapter serves
   * through the Bun transport. A deployment on Node names
   * `nodeServer()`, and a host that hands over a Web
   * `Request`/`Response` names `fetchServer()`.
   */
  readonly transport?: Transport;
}

export type { TransportChoiceOptions };
