import type { NestHono } from '#adapter/core/context';
import type { Transport } from '#adapter/core/ports/transport';

interface BridgeTarget {
  readonly hono: NestHono;
  readonly transport: Transport;
}

interface Bridge {
  readonly install: (target: BridgeTarget) => void | Promise<void>;
  readonly name: string;
}

export type { Bridge, BridgeTarget };
