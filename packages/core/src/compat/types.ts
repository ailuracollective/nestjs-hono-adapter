import type { NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { Transport } from '#adapter/core/ports/transport';

interface BridgeTarget {
  readonly hono: NestHono;
  readonly server: () => Server;
  readonly transport: Transport;
}

interface Bridge {
  readonly install: (target: BridgeTarget) => void | Promise<void>;
  readonly name: string;
}

export type { Bridge, BridgeTarget };
