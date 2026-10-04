import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Module,
} from '@nestjs/common';
import {
  ClientProxyFactory,
  MessagePattern,
  Transport,
} from '@nestjs/microservices';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { ServerAdapter } from '../src/index.ts';
import { request, startAdapter } from './support.ts';
import type { Probe } from './support.ts';

/** The interface a case binds both transports to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** The pattern the microservice fixture answers. */
const SUM = 'sum';

/** The first value the fixture is asked to sum. */
const FIRST = 1;

/** The second value the fixture is asked to sum. */
const SECOND = 2;

/** What summing those two values answers. */
const TOTAL = 3;

/**
 * A controller that is both an HTTP route and a message
 * handler, which is what proves the two transports share one
 * application rather than one replacing the other.
 */
@Controller()
class HybridController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  @MessagePattern(SUM)
  public sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }
}

@Module({ controllers: [HybridController] })
class HybridModule {}

/** The port a listening server was bound to. */
function portOf(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new TypeError('the system did not hand out a port');
  }
  return address.port;
}

/**
 * A port nothing is listening on, released so the case can bind
 * the microservice to it. Nest's TCP transport gives no way to
 * read back the port it picked for itself.
 */
async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(ANY_PORT, LOCALHOST);
  await once(server, 'listening');
  const address = server.address();
  server.close();
  await once(server, 'close');
  return portOf(address);
}

/** Starts the hybrid fixture on a microservice port of its own. */
function startHybrid(port: number): Promise<Probe> {
  return startAdapter(new ServerAdapter(), {
    configure: (app) => {
      app.connectMicroservice({
        options: { host: LOCALHOST, port },
        transport: Transport.TCP,
      });
    },
    module: HybridModule,
  });
}

/** A client of the microservice the fixture runs. */
function clientFor(port: number): ClientProxy {
  return ClientProxyFactory.create({
    options: { host: LOCALHOST, port },
    transport: Transport.TCP,
  });
}

/** Asks the fixture to sum the two values. */
function sum(client: ClientProxy): Promise<number> {
  return firstValueFrom(
    client.send<number>(SUM, [FIRST, SECOND]),
  );
}

/** Says that the HTTP route of the same module still answers. */
async function expectPing(probe: Probe): Promise<void> {
  const response = await request(probe, '/ping');
  expect(response.status).toBe(HttpStatus.OK);
  expect(response.body).toStrictEqual({ pong: true });
}

/** Closes the client, then the application, and then it again. */
async function closeAll(
  probe: Probe,
  client: ClientProxy,
): Promise<void> {
  await client.close();
  await probe.close();
  await probe.close();
}

test('a TCP microservice answers while HTTP still serves', async () => {
  const port = await freePort();
  const probe = await startHybrid(port);
  const client = clientFor(port);
  try {
    await probe.app.startAllMicroservices();
    await client.connect();
    expect(await sum(client)).toBe(TOTAL);
    await expectPing(probe);
  } finally {
    await closeAll(probe, client);
  }
});

test('a microservice that served nothing closes cleanly', async () => {
  const port = await freePort();
  const probe = await startHybrid(port);
  await probe.app.startAllMicroservices();
  await probe.close();
  await probe.close();
});
