import { Logger } from '@nestjs/common';
import type { WsMessageHandler } from '@nestjs/common';
import { AbstractWsAdapter } from '@nestjs/websockets';
import {
  first,
  fromEvent,
  mergeMap,
  share,
  takeUntil,
} from 'rxjs';
import type { Observable } from 'rxjs';

import type {
  ServerAdapter,
  WebSocketSupport,
} from '@ailura/nestjs-hono-adapter';
import {
  CLOSE_EVENT,
  MESSAGE_EVENT,
  indexHandlers,
  parseFrame,
} from './client/index.ts';
import type {
  HonoSocket,
  HonoWsAdapterOptions,
  MessageParser,
} from './client/index.ts';
import { Dispatcher } from './dispatch.ts';
import { GatewaySockets } from './gateway.ts';
import { GatewayServer, normalizePath } from './server.ts';
import type { HonoGatewayOptions } from './server.ts';
import { ensureSupported, nodeWebSocket } from './upgrade.ts';

class HonoWsAdapter extends AbstractWsAdapter {
  /** The HTTP adapter whose application serves the gateways. */
  private readonly adapter: ServerAdapter;
  /** The websocket support the transport answered with. */
  private readonly support: WebSocketSupport;
  /** Wires the gateways and their sockets onto the application. */
  private readonly sockets: GatewaySockets;
  /** The gateway server serving each path. */
  private readonly servers = new Map<string, GatewayServer>();
  /** Reports failures from the gateways and their sockets. */
  private readonly logger = new Logger(HonoWsAdapter.name);
  /** Undoes the injected upgrade listener, once installed. */
  private detach: (() => void) | undefined;
  /** Whether the runtime server hands upgrades to the app. */
  private injected = false;
  /** Turns the frames of every gateway into answers. */
  private dispatch: Dispatcher;

  /** Builds the adapter on the HTTP adapter it serves. */
  public constructor(
    httpAdapter: ServerAdapter,
    options: HonoWsAdapterOptions = {},
  ) {
    super(httpAdapter);
    this.adapter = httpAdapter;
    const app = httpAdapter.getHono();
    const factory =
      httpAdapter.getTransport().createWebSocket ??
      nodeWebSocket;
    this.support = factory(app);
    this.sockets = new GatewaySockets(
      this.support,
      this.logger,
      this.adapter,
    );
    this.dispatch = new Dispatcher(
      options.messageParser ?? parseFrame,
      this.logger,
    );
  }

  /** Opens the server one gateway path is served by. */
  public override create(
    port: number,
    options: HonoGatewayOptions = {},
  ): GatewayServer {
    ensureSupported(port, options);
    return this.open(normalizePath(options.path));
  }

  /** Bridges the handlers of one client onto its frames. */
  public override bindMessageHandlers(
    client: HonoSocket,
    handlers: WsMessageHandler[],
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    const byEvent = indexHandlers(handlers);
    const closed = fromEvent(client, CLOSE_EVENT).pipe(
      share(),
      first(),
    );
    const answers = fromEvent(client, MESSAGE_EVENT).pipe(
      mergeMap((raw: unknown) =>
        this.dispatch.answer(raw, byEvent, transform),
      ),
      takeUntil(closed),
    );
    answers.subscribe((reply) => {
      client.sendJson(reply);
    });
  }

  /** Tells a gateway that a client went away. */
  public override bindClientDisconnect(
    client: HonoSocket,
    callback: () => void,
  ): void {
    client.once(CLOSE_EVENT, callback);
  }

  /** Closes every socket a gateway path is serving. */
  public override close(server: GatewayServer): Promise<void> {
    server.close();
    return Promise.resolve();
  }

  /** Releases the paths and sockets it registered. */
  public override dispose(): Promise<void> {
    this.release();
    return Promise.resolve();
  }

  /** Replaces the reader of incoming frames. */
  public setMessageParser(parser: MessageParser): void {
    this.dispatch = new Dispatcher(parser, this.logger);
  }

  /** Attaches the error listeners every path needs. */
  public bindErrorHandler(
    server: GatewayServer,
  ): GatewayServer {
    return this.sockets.attachErrorHandler(server);
  }

  /** Closes the servers and undoes the upgrade injection. */
  private release(): void {
    const servers = [...this.servers.values()];
    this.servers.clear();
    for (const server of servers) {
      server.close();
    }
    const { detach } = this;
    if (detach !== undefined) {
      detach();
    }
    this.detach = undefined;
    this.injected = false;
  }

  /** Serves one path, reusing the server already serving it. */
  private open(path: string): GatewayServer {
    const known = this.servers.get(path);
    if (known !== undefined) {
      return known;
    }
    const server = this.bindErrorHandler(new GatewayServer());
    this.servers.set(path, server);
    this.sockets.serve(path, server);
    this.inject();
    return server;
  }

  /** Lets the runtime server hand upgrades to the app. */
  private inject(): void {
    if (this.injected) {
      return;
    }
    this.detach = this.support.install(
      this.adapter.getHttpServer(),
    );
    this.injected = true;
  }
}

export { HonoWsAdapter };
