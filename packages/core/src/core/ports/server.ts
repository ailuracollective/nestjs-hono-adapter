import type { EventEmitter } from 'node:events';

/** The address Nest formats from a listening server. */
interface Address {
  /** The IP address or hostname the server is on. */
  readonly address: string;
  /** The network family of the address. */
  readonly family: string;
  /** The port number the server is listening on. */
  readonly port: number;
}

/** The server Nest drives, as the port the core depends on. */
interface Server extends EventEmitter {
  /** Starts the server, answering Nest's callback once it is up. */
  listen: (
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ) => void;
  /** Stops the server, optionally dropping its connections. */
  close: (closeActiveConnections?: boolean) => Promise<void>;
  /** The address it is listening on, or a unix socket path. */
  address: () => Address | string | undefined;
}

export type { Address, Server };
