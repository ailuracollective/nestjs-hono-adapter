import type { NestContext, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { Transport } from '#adapter/core/ports/transport';

/**
 * The members a bridge may fit on the adapter it is installed on. A bridge patches the application,
 * not the class, so two applications in one process cannot see each other's changes.
 *
 * The adapter is handed over before its response writer is initialized. A bridge may replace these
 * members during installation, but must not call them until the application has started.
 */
interface BridgeAdapter {
  reply: (response: NestContext, body: unknown, statusCode?: number) => void;
  redirect: (response: NestContext, statusCode: number, url: string) => void;
}

interface BridgeTarget {
  /**
   * The application's adapter. Its `reply` and `redirect` members are fitted for later use; they
   * are not callable until the adapter has completed construction.
   */
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
