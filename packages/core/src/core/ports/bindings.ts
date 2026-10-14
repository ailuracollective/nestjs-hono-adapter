import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

interface Socket extends EventEmitter {
  remoteAddress?: string | undefined;
  setKeepAlive?: (enable?: boolean, initialDelay?: number) => Socket;
  setNoDelay?: (noDelay?: boolean) => Socket;
  setTimeout?: (timeout: number, callback?: () => void) => Socket;
}

class CarrierSocket extends EventEmitter implements Socket {
  public remoteAddress: string | undefined;
  public setKeepAlive?: (enable?: boolean, initialDelay?: number) => Socket;
  public setNoDelay?: (noDelay?: boolean) => Socket;
  public setTimeout?: (timeout: number, callback?: () => void) => Socket;

  public constructor(remoteAddress: string | undefined) {
    super();
    this.remoteAddress = remoteAddress;
  }
}

interface SocketAddress {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

interface Incoming {
  readonly socket: Socket;
  readonly httpVersionMajor?: number | undefined;
  readonly on: (event: string, listener: () => void) => unknown;
  readonly once: (event: string, listener: () => void) => unknown;
  readonly removeListener: (event: string, listener: () => void) => unknown;
  readonly emit: (event: string) => boolean;
}

class RequestCarrier extends EventEmitter implements Incoming {
  public readonly socket: Socket;
  public readonly httpVersionMajor = 1;

  public constructor(remoteAddress: string | undefined) {
    super();
    this.socket = new CarrierSocket(remoteAddress);
  }
}

interface Bindings {
  readonly incoming?: Incoming | undefined;
  readonly outgoing?: ServerResponse | undefined;
  readonly server?: unknown;
}

const remoteAddressOf = (remote: SocketAddress | null): string | undefined => {
  if (remote === null) return undefined;
  return remote.address;
};

export { CarrierSocket, RequestCarrier, remoteAddressOf };
export type { Bindings, Incoming, Socket, SocketAddress };
