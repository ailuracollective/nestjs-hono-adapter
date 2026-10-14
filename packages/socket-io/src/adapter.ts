import { Logger } from '@nestjs/common';
import type {
  INestApplicationContext,
  WsMessageHandler,
} from '@nestjs/common';
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
import { attachEngine } from './engine.ts';
import type { BunEngine } from './engine.ts';

import {
  ATTACHED_PORT,
  DISCONNECT_EVENT,
  deliver,
  isAnswered,
  isCallable,
  rootOf,
  splitFrame,
} from './frames.ts';
import type {
  Ack,
  Answer,
  IoOptions,
  Payload,
} from './frames.ts';

/** An application that answers with the server it serves. */
interface ServerHost {
  getHttpServer: () => unknown;
}

/** Says whether a value is an application serving a server. */
const isServerHost = (value: unknown): value is ServerHost =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getHttpServer') === 'function';

/** Reads the server an application answers with, if it is one. */
const serverOf = (value: unknown): object | undefined => {
  const server: unknown = isServerHost(value)
    ? value.getHttpServer()
    : value;
  return typeof server === 'object' && server !== null
    ? server
    : undefined;
};

class HonoIoAdapter extends AbstractWsAdapter {
  /** Reports failures from the socket.io layer. */
  protected readonly logger = new Logger(HonoIoAdapter.name);

  /** Reads the server an application answers with, if it is one. */
  public constructor(
    appOrHttpServer?: INestApplicationContext | object,
  ) {
    super(serverOf(appOrHttpServer));
  }

  /** The shared disconnect of every client. */
  private readonly disconnects = new WeakMap<
    Socket,
    Observable<unknown>
  >();

  /** The roots whose HTTP listeners this adapter created. */
  private readonly ownedServers = new WeakSet<Server>();

  /**
   * The Bun engines this adapter bound, by the server they
   * serve.
   */
  private readonly engines = new WeakMap<Server, BunEngine>();

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
    if (options.namespace !== undefined) {
      return this.createIOServer(port, options).of(
        options.namespace,
      );
    }
    return this.createIOServer(port, options);
  }

  /** Attaches socket.io to the server this adapter serves. */
  public createIOServer(
    port: number,
    options?: ServerOptions,
  ): Server {
    if (port === ATTACHED_PORT) {
      return this.attach(this.httpServer, options);
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

  /** Splits a frame into its data and its acknowledgement. */
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

  /** Closes socket.io and the listener this adapter opened. */
  public override close(
    server: Server | Namespace,
  ): Promise<void> {
    const io = rootOf(server);
    const engine = this.engines.get(io);
    io.disconnectSockets(true);
    if (engine !== undefined) {
      engine.close();
      return Promise.resolve();
    }
    if (this.ownedServers.has(io)) {
      return io.close();
    }
    io.engine.close();
    return Promise.resolve();
  }

  /**
   * Binds a gateway to the connected server, or refuses the
   * transport.
   */
  private attach(
    host: unknown,
    options?: ServerOptions,
  ): Server {
    const attached = attachEngine(host, options);
    if (attached === undefined) {
      assertAttachable(host);
      return new Server(host, options);
    }
    this.engines.set(attached.io, attached.engine);
    return attached.io;
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
        deliver(socket, answer, this.logger);
      });
  }

  /** Answers one frame from the handler's own stream. */
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

  /** The disconnect of a client, shared by its events. */
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
export type { IoOptions } from './frames.ts';
