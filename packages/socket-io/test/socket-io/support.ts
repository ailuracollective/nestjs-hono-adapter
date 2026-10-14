import { NestFactory } from '@nestjs/core';
import { firstValueFrom, from, fromEvent, throwError, timeout } from 'rxjs';
import { io as connect } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';

import { ServerAdapter } from '#adapter/index';
import type { Transport } from '#adapter/core/ports/transport';
import { nodeServer } from '#adapter/servers/node';
import { HonoIoAdapter } from '#socket-io/index';
import { GatewayModule } from './gateways.ts';

const TIMEOUT_MS = 4000;

const QUIET_MS = 200;

const LOCALHOST = '127.0.0.1';

const ANY_PORT = 0;

const within = <Result>(work: Promise<Result>, label: string): Promise<Result> =>
  firstValueFrom(
    from(work).pipe(
      timeout({
        first: TIMEOUT_MS,
        with: () => throwError(() => new Error(`${label} timed out`)),
      }),
    ),
  );

const received = <Value>(socket: ClientSocket, event: string): Promise<Value> =>
  within(firstValueFrom(fromEvent<Value>(socket, event)), `the ${event} event`);

const quiet = async (): Promise<void> => {
  await Bun.sleep(QUIET_MS);
};

interface Started {
  readonly close: () => Promise<void>;
  readonly url: string;
}

const start = async (transport: Transport = nodeServer()): Promise<Started> => {
  const adapter = new ServerAdapter({ transport });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoIoAdapter(app));
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string')
    throw new TypeError('the adapter answered with no port');
  return {
    close: () => app.close(),
    url: `http://${LOCALHOST}:${address.port}`,
  };
};

const open = async (url: string, namespace = ''): Promise<ClientSocket> => {
  const socket = connect(`${url}${namespace}`, {
    transports: ['websocket'],
  });
  await received(socket, 'connect');
  return socket;
};

export { ANY_PORT, LOCALHOST, open, quiet, received, start, within };
export type { Started };
