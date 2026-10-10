import type { EventEmitter } from 'node:events';

/**
 * The server Nest drives, as the port the core depends on.
 * `NestApplication` reads the `'error'` event and `address()`
 * off the value `getHttpServer()` answers, and the adapter
 * calls `listen()` and `close()`. Each runtime's transport
 * builds one.
 */

/** The address Nest formats from a listening server. */
interface Address {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

interface Server extends EventEmitter {
  /** Starts the server, answering Nest's callback once it is up. */
  listen: (
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ) => void;
  /**
   * Stops the server, optionally dropping the connections it
   * holds.
   */
  close: (closeActiveConnections?: boolean) => Promise<void>;
  /**
   * The address it is listening on, or the path of a unix
   * socket.
   */
  address: () => Address | string | undefined;
}

export type { Address, Server };
