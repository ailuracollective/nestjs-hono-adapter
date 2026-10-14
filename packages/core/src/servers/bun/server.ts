import { EventEmitter } from 'node:events';
import { tlsOf } from '#adapter/servers/bun-runtime';
import type { NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type {
  BunAddress,
  BunRuntime,
  HttpsOptions,
  ServeOptions,
} from '#adapter/servers/bun-runtime';
import { addressOf, closeServer } from './lifecycle.ts';
import { callbackOf, hostnameOf } from './listen-args.ts';
import { fetchOf } from './request.ts';
import { applyAddress, baseOptions } from './serve-options.ts';

interface NativeHandler {
  readonly handleRequest: (
    request: Request,
    server: BunRuntime,
  ) => Response | Promise<Response> | undefined;
  readonly idleTimeout: number;
  readonly websocket: unknown;
}

class BunServer extends EventEmitter implements Server {
  private readonly app: NestHono;
  private server: BunRuntime | undefined;
  private native: NativeHandler | undefined;
  private websocket: unknown;
  private readonly tls: unknown;
  private unix: string | undefined;

  public constructor(app: NestHono, certificate?: HttpsOptions) {
    super();
    this.app = app;
    this.tls = tlsOf(certificate);
  }

  public useWebSocket(handler: unknown): void {
    this.websocket = handler;
  }

  public useNativeHandler(handler: NativeHandler): void {
    this.native = handler;
  }

  public listen(
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    const hostname = hostnameOf(hostnameOrCallback);
    const done = callbackOf(hostnameOrCallback, callback);
    try {
      this.start(port, hostname);
      if (done !== undefined) done();
    } catch (error) {
      this.emit('error', error);
      if (done !== undefined) done(error);
    }
  }

  public address(): BunAddress | string | undefined {
    return addressOf(this.unix, this.server);
  }

  public async close(closeActiveConnections = false): Promise<void> {
    const { server } = this;
    this.server = undefined;
    await closeServer(server, closeActiveConnections);
  }

  private start(port: string | number, hostname: string | undefined): void {
    const { native } = this;
    const options = baseOptions(
      (request, server) =>
        native === undefined
          ? fetchOf(this.app, request, server)
          : (native.handleRequest(request, server) ?? fetchOf(this.app, request, server)),
      native === undefined ? this.websocket : native.websocket,
      this.tls,
    );
    if (native !== undefined) options.idleTimeout = native.idleTimeout;
    this.unix = applyAddress(options, port, hostname);
    this.server = Bun.serve(options as unknown as ServeOptions) as unknown as BunRuntime;
  }
}

export { BunServer };
export type { NativeHandler };
export { noDisposer } from './listen-args.ts';
export type { ListenCallback } from './listen-args.ts';
