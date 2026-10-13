import { Logger } from '@nestjs/common';
import type { WsMessageHandler } from '@nestjs/common';
import { AbstractWsAdapter } from '@nestjs/websockets';
import { defer, EMPTY, fromEvent } from 'rxjs';
import type { Observable } from 'rxjs';
import {
  catchError,
  filter,
  first,
  map,
  mergeMap,
  share,
  takeUntil,
} from 'rxjs/operators';
import { Server } from 'socket.io';
import type {
  Namespace,
  ServerOptions,
  Socket,
} from 'socket.io';

import { assertAttachable } from './refusal.ts';

/** The event socket.io fires when a client goes away. */
const DISCONNECT_EVENT = 'disconnect';

/**
 * The port that means "attach to the server already listening".
 * Nest asks for the server this way whatever port the
 * application was started on. An explicit nonzero gateway port
 * opens a listener of its own.
 */
const ATTACHED_PORT = 0;

/** Where the acknowledgement of a frame sits in its array. */
const LAST = -1;

/** The length of the array a frame is unwrapped from. */
const UNWRAPPED = 1;

/** The options `create()` reads a namespace and a server out of. */
interface IoOptions extends ServerOptions {
  readonly namespace?: string;
  readonly server?: Server;
}

/** An acknowledgement a client sent along with its frame. */
type Ack = (...args: unknown[]) => void;

/**
 * A reply a handler asked to send on an event, rather than
 * answer.
 */
interface Emitted {
  readonly event: string;
  readonly data?: unknown;
}

/** The data of a frame, and the acknowledgement it carried. */
interface Payload {
  readonly ack?: Ack;
  readonly data?: unknown;
}

/** One reply, with what the handler said to do with it. */
interface Answer {
  readonly ack: Ack | undefined;
  readonly manual: boolean;
  readonly response: unknown;
}

/** Says whether a value can be called. */
function isCallable(value: unknown): value is Ack {
  return typeof value === 'function';
}

/** Says whether a reply names an event to be sent on. */
function isEmitted(reply: unknown): reply is Emitted {
  if (typeof reply !== 'object' || reply === null) {
    return false;
  }
  if (!('event' in reply)) {
    return false;
  }
  return typeof reply.event === 'string';
}

/** Says whether a handler answered anything at all. */
function isAnswered(reply: unknown): boolean {
  return reply !== null && reply !== undefined;
}

/** Splits an array frame into its data and its acknowledgement. */
function splitFrame(frame: unknown[]): Payload {
  const last: unknown = frame.at(LAST);
  if (!isCallable(last)) {
    return { data: frame };
  }
  const data = frame.slice(0, LAST);
  if (data.length === UNWRAPPED) {
    return { ack: last, data: data[0] };
  }
  return { ack: last, data };
}

/** The server a namespace belongs to, or the server itself. */
function rootOf(server: Server | Namespace): Server {
  if (server instanceof Server) {
    return server;
  }
  return server.server;
}

/**
 * Runs a Nest gateway on socket.io.
 *
 * The counterpart of `@nestjs/platform-socket.io`'s
 * `IoAdapter`, and reached through `./socket-io`. A consumer
 * that built its application on that adapter keeps its
 * gateways, its namespaces, its rooms, its broadcasts and its
 * acknowledgement callbacks: this adapter only binds the
 * handlers Nest declares to the events socket.io carries, and
 * socket.io owns the protocol.
 *
 * It attaches to the Node `http.Server` the transport already
 * listens on, so it works on `./node-server` — which runs on
 * Node and on Bun — and it refuses, by name, on the transports
 * that answer with no such server: see `assertAttachable`.
 *
 * @publicApi
 */
class HonoIoAdapter extends AbstractWsAdapter {
  protected readonly logger = new Logger(HonoIoAdapter.name);

  /**
   * The disconnect of every client, shared and taken once, so a
   * gateway that binds several events to one socket does not
   * attach a listener per event.
   */
  private readonly disconnects = new WeakMap<
    Socket,
    Observable<unknown>
  >();

  /** The roots whose HTTP listeners this adapter created. */
  private readonly ownedServers = new WeakSet<Server>();

  /** The server, or the namespace, a gateway is bound to. */
  public override create(
    port: number,
    options?: IoOptions,
  ): Server | Namespace {
    if (options === undefined) {
      return this.createIOServer(port);
    }
    if (
      options.server !== undefined &&
      options.namespace !== undefined
    ) {
      return options.server.of(options.namespace);
    }
    // The socket.io server reads the keys it knows and leaves
    // the rest alone, so the two Nest adds travel with the
    // options rather than being copied out of them.
    if (options.namespace !== undefined) {
      return this.createIOServer(port, options).of(
        options.namespace,
      );
    }
    return this.createIOServer(port, options);
  }

  /**
   * Attaches socket.io to the server this adapter serves
   * through, or opens one on an explicit nonzero gateway port.
   */
  public createIOServer(
    port: number,
    options?: ServerOptions,
  ): Server {
    if (port === ATTACHED_PORT) {
      assertAttachable(this.httpServer);
      return new Server(this.httpServer, options);
    }
    const server = new Server(port, options);
    this.ownedServers.add(server);
    return server;
  }

  /** Binds every event a gateway declared to its handler. */
  public override bindMessageHandlers(
    socket: Socket,
    handlers: WsMessageHandler[],
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    for (const handler of handlers) {
      this.bindMessage(socket, handler, transform);
    }
  }

  /**
   * Splits a frame into its data and the acknowledgement a
   * client may have appended to it, as socket.io sends both in
   * one array.
   */
  public mapPayload(payload: unknown): Payload {
    if (Array.isArray(payload)) {
      return splitFrame(payload);
    }
    if (isCallable(payload)) {
      return { ack: payload };
    }
    return { data: payload };
  }

  /** Tells a gateway that a client went away. */
  public override bindClientDisconnect(
    client: Socket,
    callback: Ack,
  ): void {
    client.once(DISCONNECT_EVENT, (reason: unknown): void => {
      callback(reason);
    });
  }

  /**
   * Lets every client go and closes socket.io, without waiting
   * for a shared HTTP server to answer. A standalone gateway's
   * listener belongs to this adapter and is closed here.
   *
   * Socket.io's own `close()` waits for `httpServer.close()`,
   * and this adapter's Node transport answers that call with a
   * promise whose callback is never invoked (issue #121), so
   * awaiting it would hang the application's shutdown. The
   * sockets are closed here instead, the way `./ws` closes the
   * ones on its paths, and the transport that owns the server
   * closes it once this returns.
   *
   * Nest hands this the namespace a namespaced gateway was
   * bound to as well as the server itself, and only the server
   * owns the engine, so a namespace reaches it through its
   * root.
   */
  public override close(
    server: Server | Namespace,
  ): Promise<void> {
    const io = rootOf(server);
    if (this.ownedServers.has(io)) {
      return io.close();
    }
    io.disconnectSockets(true);
    io.engine.close();
    return Promise.resolve();
  }

  /** Binds one event name to the handler that answers it. */
  private bindMessage(
    socket: Socket,
    handler: WsMessageHandler,
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    fromEvent(socket, handler.message)
      .pipe(
        mergeMap((payload: unknown) =>
          this.answer(handler, payload, transform),
        ),
        takeUntil(this.disconnectOf(socket)),
      )
      .subscribe((answer: Answer): void => {
        this.deliver(socket, answer);
      });
  }

  /**
   * Answers one frame, once the handler's own stream has
   * produced a reply.
   *
   * The handler runs inside `defer`, so a synchronous throw
   * becomes an error notification, and `catchError` stops that
   * from tearing down the event's stream — which would silence
   * the event for the client for good. A handler whose error
   * filter rethrows is an application bug, so the failure is
   * logged rather than dropped.
   */
  private answer(
    handler: WsMessageHandler,
    payload: unknown,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<Answer> {
    const { ack, data } = this.mapPayload(payload);
    return defer(() =>
      transform(handler.callback(data, ack)),
    ).pipe(
      filter(isAnswered),
      map((response: unknown): Answer => ({
        ack,
        manual: handler.isAckHandledManually,
        response,
      })),
      catchError((error: unknown) => {
        this.logger.error(error);
        return EMPTY;
      }),
    );
  }

  /**
   * Sends a reply to the client: on the event it named, or as
   * the answer to the frame.
   *
   * Socket.io walks a payload recursively to encode it, so a
   * reply echoing a client-controlled value nested deeply
   * enough overflows the stack. A throw here would escape the
   * subscriber, which RxJS rethrows asynchronously, killing the
   * process.
   */
  private deliver(socket: Socket, answer: Answer): void {
    try {
      if (isEmitted(answer.response)) {
        socket.emit(
          answer.response.event,
          answer.response.data,
        );
        return;
      }
      if (!answer.manual && answer.ack !== undefined) {
        answer.ack(answer.response);
      }
    } catch (error: unknown) {
      this.logger.error(error);
    }
  }

  /**
   * The disconnect of a client, shared by the events bound to
   * it.
   */
  private disconnectOf(socket: Socket): Observable<unknown> {
    let shared = this.disconnects.get(socket);
    if (shared === undefined) {
      shared = fromEvent(socket, DISCONNECT_EVENT).pipe(
        share(),
        first(),
      );
      this.disconnects.set(socket, shared);
    }
    return shared;
  }
}

export { HonoIoAdapter };
export type { IoOptions };
