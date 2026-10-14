import type { NestHono } from '#adapter/core/context';
import type { Transport } from '#adapter/core/ports/transport';

/**
 * What a bridge is installed against: the app and its
 * transport.
 */
interface BridgeTarget {
  /** The Hono application the bridge reshapes. */
  readonly hono: NestHono;
  /** The runtime-specific half of the adapter. */
  readonly transport: Transport;
}

/**
 * One named shim that lets another Nest platform's contract
 * run.
 */
interface Bridge {
  /** What the bridge may not promise synchronously. */
  readonly install: (
    target: BridgeTarget,
  ) => void | Promise<void>;
  /** The name it is registered, reported and refused under. */
  readonly name: string;
}

export type { Bridge, BridgeTarget };
