import type { Transport } from './transport.ts';
import type { TransportOptions } from './hono-lifecycle.ts';

/**
 * The transport a deployment names, and the global-object
 * switch read only where no transport is named.
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
   * Whether `@hono/node-server` may replace the global
   * `Request` and `Response` with its lighter classes. Read
   * only where no transport is named, because it is a switch on
   * the transport the adapter picks itself: it is the option
   * every deployment set before the transports split, and it is
   * handed to the Node transport with the default it always
   * had. `nodeServer()` takes its own, for the deployment that
   * names the transport instead of relying on this.
   */
  readonly overrideGlobalObjects?: boolean;
  /**
   * The runtime to serve through. Left out, the adapter serves
   * through the Node transport — the runtime every deployment
   * was served by before the transports split, which runs on
   * Bun as well as on Node. `bunServer()` picks Bun's own
   * server instead, and `fetchServer()` a host that hands over
   * a Web `Request`.
   */
  readonly transport?: Transport;
}

export type { TransportChoiceOptions };
