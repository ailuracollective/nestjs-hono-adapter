import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

/** The client socket Nest's SSE path reads. */
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

/** The synthesized socket of a request with no connection. */
class CarrierSocket extends EventEmitter implements Socket {
  /** The client address the runtime reported. */
  public remoteAddress: string | undefined;
  /** Enables or disables keep-alive on the socket. */
  public setKeepAlive?: (
    enable?: boolean,
    initialDelay?: number,
  ) => Socket;
  /** Enables or disables Nagle's algorithm. */
  public setNoDelay?: (noDelay?: boolean) => Socket;
  /** Arms or clears the socket timeout. */
  public setTimeout?: (
    timeout: number,
    callback?: () => void,
  ) => Socket;

  /** Builds the socket with the address the runtime reported. */
  public constructor(remoteAddress: string | undefined) {
    super();
    this.remoteAddress = remoteAddress;
  }
}

/** The client address a runtime reports for one request. */
interface SocketAddress {
  /** The IP address of the client. */
  readonly address: string;
  /** The network family of the client. */
  readonly family: string;
  /** The port number of the client. */
  readonly port: number;
}

/** What Nest's SSE path reads off the request. */
interface Incoming {
  /** The socket the request is read from. */
  readonly socket: Socket;
  /** The HTTP version the request is reported as. */
  readonly httpVersionMajor?: number | undefined;
  /** The event emitter for the request. */
  readonly on: (event: string, listener: () => void) => unknown;
  /** The event emitter for the request, once. */
  readonly once: (
    event: string,
    listener: () => void,
  ) => unknown;
  /** The event emitter for the request, removed. */
  readonly removeListener: (
    event: string,
    listener: () => void,
  ) => unknown;
  /** The event emitter for the request, removed once. */
  readonly emit: (event: string) => boolean;
}

/** The request carrier built when no message is handed over. */
class RequestCarrier extends EventEmitter implements Incoming {
  /** The synthesized socket behind the request. */
  public readonly socket: Socket;
  /** The HTTP version the request is reported as. */
  public readonly httpVersionMajor = 1;

  /** Builds the carrier with the address the runtime reported. */
  public constructor(remoteAddress: string | undefined) {
    super();
    this.socket = new CarrierSocket(remoteAddress);
  }
}

/** The environment a transport attaches to every request. */
interface Bindings {
  /** The client address the runtime reported, if any. */
  readonly incoming?: Incoming | undefined;
  /** The Node response the transport attached, if any. */
  readonly outgoing?: ServerResponse | undefined;
  /** The server the transport is attached to, if any. */
  readonly server?: unknown;
}

/** The address a runtime reported, or nothing. */
const remoteAddressOf = (
  remote: SocketAddress | null,
): string | undefined => {
  if (remote === null) {
    return undefined;
  }
  return remote.address;
};

export { CarrierSocket, RequestCarrier, remoteAddressOf };
export type { Bindings, Incoming, Socket, SocketAddress };
