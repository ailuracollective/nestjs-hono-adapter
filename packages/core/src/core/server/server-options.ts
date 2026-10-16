import type { Transport } from '#adapter/core/ports/transport';
import type { TransportOptions } from './hono-lifecycle.ts';

interface TransportChoiceOptions extends Omit<TransportOptions, 'transport'> {
  readonly transport?: Transport;
}

export type { TransportChoiceOptions };
