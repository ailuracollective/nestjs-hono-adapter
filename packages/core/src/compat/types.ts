import type { NestContext, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { Transport } from '#adapter/core/ports/transport';

/** The adapter members a bridge may fit on the application it was handed. */
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
