import { expect, test } from 'bun:test';
import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ApolloDriver } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { createClient } from 'graphql-ws';

import { request, startProbe } from '#test/probe';
import { originOf } from '#test/probe/in-process';

const PATH = '/graphql';

const COUNTED = 2;

const OK = 200;

// oxlint-disable-next-line require-await -- a subscription resolver answers an AsyncIterator.
async function* countdown(): AsyncGenerator<{ countdown: number }> {
  for (let step = 1; step <= COUNTED; step += 1) yield { countdown: step };
}

/** A schema with one subscription, served by the driver the bridge patches. */
const subscriptionModule = (): Type<unknown> => {
  @Module({
    imports: [
      GraphQLModule.forRoot({
        driver: ApolloDriver,
        path: PATH,
        resolvers: {
          Query: { echo: () => 'ok' },
          Subscription: { countdown: { subscribe: countdown } },
        },
        subscriptions: { 'graphql-ws': true },
        typeDefs: 'type Query { echo: String } type Subscription { countdown: Int }',
      }),
    ],
  })
  class SubscriptionFixture {}
  return SubscriptionFixture;
};

const socketUrl = (origin: string): string => `${origin.replace('http', 'ws')}${PATH}`;

test('a subscription answers over the Bun transport', async () => {
  const probe = await startProbe({ mode: 'socket', module: subscriptionModule() });
  const client = createClient({ url: socketUrl(originOf(probe.adapter)) });
  try {
    const seen: unknown[] = [];
    const { promise, reject, resolve } = Promise.withResolvers();
    client.subscribe(
      { query: 'subscription { countdown }' },
      {
        complete: () => {
          resolve();
        },
        error: (error) => {
          reject(error);
        },
        next: (value) => {
          seen.push(value);
        },
      },
    );
    await promise;
    expect(seen).toStrictEqual([{ data: { countdown: 1 } }, { data: { countdown: 2 } }]);
  } finally {
    await client.dispose();
    await probe.close();
  }
});

test('the endpoint still answers where subscriptions are served', async () => {
  const probe = await startProbe({ mode: 'socket', module: subscriptionModule() });
  try {
    const answer = await request(probe, PATH, {
      body: JSON.stringify({ query: '{ echo }' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(answer.status).toBe(OK);
    expect(answer.body).toStrictEqual({ data: { echo: 'ok' } });
  } finally {
    await probe.close();
  }
});
