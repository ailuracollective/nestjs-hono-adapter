import { Logger } from '@nestjs/common';
import type { INestApplicationContext, WsMessageHandler } from '@nestjs/common';
import { AbstractWsAdapter } from '@nestjs/websockets';
import { defer, EMPTY, fromEvent } from 'rxjs';
import type { Observable } from 'rxjs';
import { catchError, filter, first, map, mergeMap, share, takeUntil } from 'rxjs/operators';
import { Server } from 'socket.io';
import type { Namespace, ServerOptions, Socket } from 'socket.io';

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
import type { Ack, Answer, IoOptions, Payload } from './frames.ts';

interface ServerHost {
  getHttpServer: () => unknown;
}

const isServerHost = (value: unknown): value is ServerHost =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getHttpServer') === 'function';

const serverOf = (value: unknown): object | undefined => {
  const server: unknown = isServerHost(value) ? value.getHttpServer() : value;
  return typeof server === 'object' && server !== null ? server : undefined;
};

class HonoIoAdapter extends AbstractWsAdapter {
  protected readonly logger = new Logger(HonoIoAdapter.name);

  public constructor(appOrHttpServer?: INestApplicationContext | object) {
    super(serverOf(appOrHttpServer));
  }

  private readonly disconnects = new WeakMap<Socket, Observable<unknown>>();

  private readonly ownedServers = new WeakSet<Server>();

  private readonly engines = new WeakMap<Server, BunEngine>();

  public override create(port: number, options?: IoOptions): Server | Namespace {
    if (options === undefined) return this.createIOServer(port);
    if (options.server !== undefined && options.namespace !== undefined)
      return options.server.of(options.namespace);
    if (options.namespace !== undefined)
      return this.createIOServer(port, options).of(options.namespace);
    return this.createIOServer(port, options);
  }

  public createIOServer(port: number, options?: ServerOptions): Server {
    if (port === ATTACHED_PORT) return this.attach(this.httpServer, options);
    const server = new Server(port, options);
    this.ownedServers.add(server);
    return server;
  }

  public override bindMessageHandlers(
    socket: Socket,
    handlers: WsMessageHandler[],
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    for (const handler of handlers) {
      this.bindMessage(socket, handler, transform);
    }
  }

  public mapPayload(payload: unknown): Payload {
    if (Array.isArray(payload)) {
      return splitFrame(payload);
    }
    if (isCallable(payload)) {
      return { ack: payload };
    }
    return { data: payload };
  }

  public override bindClientDisconnect(client: Socket, callback: Ack): void {
    client.once(DISCONNECT_EVENT, (reason: unknown): void => {
      callback(reason);
    });
  }

  public override close(server: Server | Namespace): Promise<void> {
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

  private attach(host: unknown, options?: ServerOptions): Server {
    const attached = attachEngine(host, options);
    if (attached === undefined) {
      assertAttachable(host);
      return new Server(host, options);
    }
    this.engines.set(attached.io, attached.engine);
    return attached.io;
  }

  private bindMessage(
    socket: Socket,
    handler: WsMessageHandler,
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    fromEvent(socket, handler.message)
      .pipe(
        mergeMap((payload: unknown) => this.answer(handler, payload, transform)),
        takeUntil(this.disconnectOf(socket)),
      )
      .subscribe((answer: Answer): void => {
        deliver(socket, answer, this.logger);
      });
  }

  private answer(
    handler: WsMessageHandler,
    payload: unknown,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<Answer> {
    const { ack, data } = this.mapPayload(payload);
    return defer(() => transform(handler.callback(data, ack))).pipe(
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

  private disconnectOf(socket: Socket): Observable<unknown> {
    let shared = this.disconnects.get(socket);
    if (shared === undefined) {
      shared = fromEvent(socket, DISCONNECT_EVENT).pipe(share(), first());
      this.disconnects.set(socket, shared);
    }
    return shared;
  }
}

export { HonoIoAdapter };
export type { IoOptions } from './frames.ts';
