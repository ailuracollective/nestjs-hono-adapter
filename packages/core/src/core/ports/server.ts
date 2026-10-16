import type { EventEmitter } from 'node:events';

interface Address {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

interface Server extends EventEmitter {
  listen: (
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ) => void;
  close: (closeActiveConnections?: boolean) => Promise<void>;
  address: () => Address | string | undefined;
}

export type { Address, Server };
