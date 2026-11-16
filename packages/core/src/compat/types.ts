import type { NestContext, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { Transport } from '#adapter/core/ports/transport';

/**
 * The members a bridge may fit on the adapter it is installed on. A bridge patches the application,
 * not the class, so two applications in one process cannot see each other's changes.
 */
interface BridgeAdapter {
  reply: (response: NestContext, body: unknown, statusCode?: number) => void;
  redirect: (response: NestContext, statusCode: number, url: string) => void;
}

interface BridgeTarget {
  readonly adapter: BridgeAdapter;
  readonly hono: NestHono;
  readonly server: () => Server;
  readonly transport: Transport;
}

interface Bridge {
  readonly install: (target: BridgeTarget) => void | Promise<void>;
  readonly name: string;
}

export type { Bridge, BridgeAdapter, BridgeTarget };
