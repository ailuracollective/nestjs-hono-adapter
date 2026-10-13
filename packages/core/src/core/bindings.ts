import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

/**
 * The per-request bindings a transport attaches to a Hono
 * application: the request carrier Nest's Server-Sent Events
 * path reads, and — where the runtime has one — the native
 * server object, which is how a WebSocket upgrade reaches the
 * runtime's own helper and how a client address is read back.
 *
 * The core names nothing runtime-specific here: a Node
 * `IncomingMessage` and the carrier a request served without a
 * TCP socket both satisfy {@link Incoming}.
 */

/**
 * The client socket Nest's SSE path reads. The tuning calls are
 * optional: `tuneableSocket` fills in the ones a runtime does
 * not provide with what a socket that cannot be tuned has to
 * say, which is nothing. A Node `net.Socket` satisfies this as
 * it stands.
 */
interface Socket extends EventEmitter {
  remoteAddress?: string | undefined;
  setKeepAlive?: (
    enable?: boolean,
    initialDelay?: number,
  ) => Socket;
  setNoDelay?: (noDelay?: boolean) => Socket;
  setTimeout?: (
    timeout: number,
    callback?: () => void,
  ) => Socket;
}

/**
 * The socket the adapter synthesizes when a runtime serves a
 * request without handing over the connection behind it.
 */
class CarrierSocket extends EventEmitter implements Socket {
  public remoteAddress: string | undefined;
  public setKeepAlive?: (
    enable?: boolean,
    initialDelay?: number,
  ) => Socket;
  public setNoDelay?: (noDelay?: boolean) => Socket;
  public setTimeout?: (
    timeout: number,
    callback?: () => void,
  ) => Socket;

  public constructor(remoteAddress: string | undefined) {
    super();
    this.remoteAddress = remoteAddress;
  }
}

/** The client address a runtime reports for one request. */
interface SocketAddress {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

/**
 * What Nest's SSE path reads off the request. A Node
 * `IncomingMessage` satisfies it, and so does the carrier
 * below; the core never names either.
 */
interface Incoming {
  readonly socket: Socket;
  readonly httpVersionMajor?: number | undefined;
  readonly on: (event: string, listener: () => void) => unknown;
  readonly once: (
    event: string,
    listener: () => void,
  ) => unknown;
  readonly removeListener: (
    event: string,
    listener: () => void,
  ) => unknown;
  readonly emit: (event: string) => boolean;
}

/**
 * The request carrier the adapter builds when the runtime hands
 * over no message of its own. It carries a synthesized socket
 * and emits `close` when the request it belongs to is gone.
 */
class RequestCarrier extends EventEmitter implements Incoming {
  public readonly socket: Socket;
  /**
   * Read by Nest to decide whether the socket may be tuned; a
   * served request is HTTP/1.1 unless HTTP/2 was asked for, and
   * the adapter cannot tell the two apart from the request, so
   * this stays the version the tuning is safe under.
   */
  public readonly httpVersionMajor = 1;

  public constructor(remoteAddress: string | undefined) {
    super();
    this.socket = new CarrierSocket(remoteAddress);
  }
}

/** The environment a transport attaches to every request. */
interface Bindings {
  readonly incoming?: Incoming | undefined;
  /**
   * The Node response `@hono/node-server` attaches, which the
   * security hook Nest registers is handed, and which the
   * default transport keeps carrying so `context.env.outgoing`
   * reads what it read before the transports split. The Bun and
   * fetch transports leave it unset.
   */
  readonly outgoing?: ServerResponse | undefined;
  readonly server?: unknown;
}

/**
 * The address a runtime's `requestIP` reported, when it
 * reported one. Bun answers `null` for a request it cannot read
 * an address from, which the adapter carries as an absent one.
 */
function remoteAddressOf(
  remote: SocketAddress | null,
): string | undefined {
  if (remote === null) {
    return undefined;
  }
  return remote.address;
}

export { CarrierSocket, RequestCarrier, remoteAddressOf };
export type { Bindings, Incoming, Socket, SocketAddress };
