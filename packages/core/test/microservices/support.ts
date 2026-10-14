import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

import { expect } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import {
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { bunAdapter } from '#test/bun-adapter';
import { startAdapter } from '#adapter-test/support/index';
import { request } from '#test/probe';
import type { Probe } from '#test/probe';

import {
  ANY_PORT,
  FIRST,
  HybridModule,
  LOCALHOST,
  SECOND,
  SUM,
} from './fixture.ts';

/** The port a listening server was bound to. */
const portOf = (
  address: AddressInfo | string | null,
): number => {
  if (address === null || typeof address === 'string') {
    throw new TypeError('the system did not hand out a port');
  }
  return address.port;
};

/** A port nothing is listening on. */
const freePort = async (): Promise<number> => {
  const server = createServer();
  server.listen(ANY_PORT, LOCALHOST);
  await once(server, 'listening');
  const address = server.address();
  server.close();
  await once(server, 'close');
  return portOf(address);
};

/** Starts the hybrid fixture answered in process. */
const startHybrid = (port: number): Promise<Probe> =>
  startAdapter(bunAdapter(), {
    configure: (app) => {
      app.connectMicroservice({
        options: { host: LOCALHOST, port },
        transport: Transport.TCP,
      });
    },
    mode: 'in-process',
    module: HybridModule,
  });

/** A client of the microservice the fixture runs. */
const clientFor = (port: number): ClientProxy =>
  ClientProxyFactory.create({
    options: { host: LOCALHOST, port },
    transport: Transport.TCP,
  });

/** Asks the fixture to sum the two values. */
const sum = (client: ClientProxy): Promise<number> =>
  firstValueFrom(client.send<number>(SUM, [FIRST, SECOND]));

/** Says the HTTP route of the module still answers. */
const expectPing = async (probe: Probe): Promise<void> => {
  const response = await request(probe, '/ping');
  expect(response.status).toBe(HttpStatus.OK);
  expect(response.body).toStrictEqual({ pong: true });
};

/** Closes the client and the application twice. */
const closeAll = async (
  probe: Probe,
  client: ClientProxy,
): Promise<void> => {
  await client.close();
  await probe.close();
  await probe.close();
};

export {
  clientFor,
  closeAll,
  expectPing,
  freePort,
  portOf,
  startHybrid,
  sum,
};
