import { NestFactory } from '@nestjs/core';
import {
  firstValueFrom,
  from,
  fromEvent,
  throwError,
  timeout,
} from 'rxjs';
import { io as connect } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';
import { HonoIoAdapter } from '#socket-io/index';
import { GatewayModule } from './gateways.ts';

/** How long a case waits for an event before it fails. */
const TIMEOUT_MS = 4000;

/** How long a case waits before it decides nothing arrives. */
const QUIET_MS = 200;

/** The interface every case binds to, and connects to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** Runs work with a socket's timeout, failing on the label. */
const within = <Result>(
  work: Promise<Result>,
  label: string,
): Promise<Result> =>
  firstValueFrom(
    from(work).pipe(
      timeout({
        first: TIMEOUT_MS,
        with: () =>
          throwError(() => new Error(`${label} timed out`)),
      }),
    ),
  );

/** The next value the client is sent on one event. */
const received = <Value>(
  socket: ClientSocket,
  event: string,
): Promise<Value> =>
  within(
    firstValueFrom(fromEvent<Value>(socket, event)),
    `the ${event} event`,
  );

/** Waits for the quiet interval. */
const quiet = async (): Promise<void> => {
  await Bun.sleep(QUIET_MS);
};

/** The application, and the address its gateways answer on. */
interface Started {
  /** Closes the application. */
  readonly close: () => Promise<void>;
  /** The address the gateways answer on. */
  readonly url: string;
}

/** Starts the application with the socket.io adapter bound. */
const start = async (): Promise<Started> => {
  const adapter = new ServerAdapter({
    transport: nodeServer(),
  });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoIoAdapter(app));
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError('the adapter answered with no port');
  }
  return {
    close: () => app.close(),
    url: `http://${LOCALHOST}:${address.port}`,
  };
};

/** Opens a client and waits for it to be connected. */
const open = async (
  url: string,
  namespace = '',
): Promise<ClientSocket> => {
  const socket = connect(`${url}${namespace}`, {
    transports: ['websocket'],
  });
  await received(socket, 'connect');
  return socket;
};

export {
  ANY_PORT,
  LOCALHOST,
  open,
  quiet,
  received,
  start,
  within,
};
export type { Started };
