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

class HonoIoAdapter extends AbstractWsAdapter {
  /** Reports failures from the socket.io layer. */
  protected readonly logger = new Logger(HonoIoAdapter.name);

  /** The shared disconnect of every client. */
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
