import type { Transport } from '#adapter/core/ports/transport';
import type { TransportOptions } from './hono-lifecycle.ts';

/** The transport a deployment names. */
interface TransportChoiceOptions extends Omit<
  TransportOptions,
  'transport'
> {
  /** The runtime to serve through. */
  readonly transport?: Transport;
}

export type { TransportChoiceOptions };
