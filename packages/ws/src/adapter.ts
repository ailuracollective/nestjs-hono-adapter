import { Logger } from '@nestjs/common';
import type { WsMessageHandler } from '@nestjs/common';
import { AbstractWsAdapter } from '@nestjs/websockets';
import { first, fromEvent, mergeMap, share, takeUntil } from 'rxjs';
import type { Observable } from 'rxjs';

import type {
  NestHonoApplication,
  ServerAdapter,
  WebSocketSupport,
} from '@ailura/nestjs-hono-adapter';
import { CLOSE_EVENT, MESSAGE_EVENT, indexHandlers, parseFrame } from './client/index.ts';
import type { HonoSocket, HonoWsAdapterOptions, MessageParser } from './client/index.ts';
import { Dispatcher } from './dispatch.ts';
import { GatewaySockets } from './gateway.ts';
import { GatewayServer, normalizePath } from './server.ts';
import type { HonoGatewayOptions } from './server.ts';
import { ensureSupported, nodeWebSocket } from './upgrade.ts';

const serverAdapterOf = (value: NestHonoApplication | ServerAdapter): ServerAdapter =>
  'getHttpAdapter' in value ? value.getHttpAdapter() : value;

class HonoWsAdapter extends AbstractWsAdapter {
  private readonly adapter: ServerAdapter;
  private readonly support: WebSocketSupport;
  private readonly sockets: GatewaySockets;
  private readonly servers = new Map<string, GatewayServer>();
  private readonly logger = new Logger(HonoWsAdapter.name);
  private detach: (() => void) | undefined;
  private injected = false;
  private dispatch: Dispatcher;

  public constructor(
    appOrAdapter: NestHonoApplication | ServerAdapter,
    options: HonoWsAdapterOptions = {},
  ) {
    const httpAdapter = serverAdapterOf(appOrAdapter);
    super(httpAdapter);
    this.adapter = httpAdapter;
    const app = httpAdapter.getHono();
    const factory = httpAdapter.getTransport().createWebSocket ?? nodeWebSocket;
    this.support = factory(app);
    this.sockets = new GatewaySockets(this.support, this.logger, this.adapter);
    this.dispatch = new Dispatcher(options.messageParser ?? parseFrame, this.logger);
  }

  public override create(port: number, options: HonoGatewayOptions = {}): GatewayServer {
    ensureSupported(port, options);
    return this.open(normalizePath(options.path));
  }

  public override bindMessageHandlers(
    client: HonoSocket,
    handlers: WsMessageHandler[],
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    const byEvent = indexHandlers(handlers);
    const closed = fromEvent(client, CLOSE_EVENT).pipe(share(), first());
    const answers = fromEvent(client, MESSAGE_EVENT).pipe(
      mergeMap((raw: unknown) => this.dispatch.answer(raw, byEvent, transform)),
      takeUntil(closed),
    );
    answers.subscribe((reply) => {
      client.sendJson(reply);
    });
  }

  public override bindClientDisconnect(client: HonoSocket, callback: () => void): void {
    client.once(CLOSE_EVENT, callback);
  }

  public override close(server: GatewayServer): Promise<void> {
    server.close();
    return Promise.resolve();
  }

  public override dispose(): Promise<void> {
    this.release();
    return Promise.resolve();
  }

  public setMessageParser(parser: MessageParser): void {
    this.dispatch = new Dispatcher(parser, this.logger);
  }

  public bindErrorHandler(server: GatewayServer): GatewayServer {
    return this.sockets.attachErrorHandler(server);
  }

  private release(): void {
    const servers = [...this.servers.values()];
    this.servers.clear();
    for (const server of servers) {
      server.close();
    }
    const { detach } = this;
    if (detach !== undefined) detach();
    this.detach = undefined;
    this.injected = false;
  }

  private open(path: string): GatewayServer {
    const known = this.servers.get(path);
    if (known !== undefined) return known;
    const server = this.bindErrorHandler(new GatewayServer());
    this.servers.set(path, server);
    this.sockets.serve(path, server);
    this.inject();
    return server;
  }

  private inject(): void {
    if (this.injected) return;
    this.detach = this.support.install(this.adapter.getHttpServer());
    this.injected = true;
  }
}

export { HonoWsAdapter };
