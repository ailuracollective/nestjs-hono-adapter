import { expect, mock, test } from 'bun:test';
import { NestFactory } from '@nestjs/core';

import { fetchServer } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';
import { ProbeModule } from '#adapter-test/support/index';

test('listen() without a callback throws the refusal', () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  adapter.initHttpServer({});
  const server = adapter.getHttpServer();
  expect(() => {
    server.listen(0);
  }).toThrow('The fetch transport cannot listen');
  expect(() => {
    server.listen(0, 'localhost');
  }).toThrow('The fetch transport cannot listen');
});

test.each([false, true])(
  'listen() reports refusal through its callback (hostname: %j)',
  (withHostname) => {
    const adapter = new ServerAdapter({
      transport: fetchServer(),
    });
    adapter.initHttpServer({});
    const server = adapter.getHttpServer();
    const answer = mock((): void => {
      // The mock only records calls.
    });
    expect(() => {
      if (withHostname) {
        server.listen(0, 'localhost', answer);
      } else {
        server.listen(0, answer);
      }
    }).not.toThrow();
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith(expect.any(Error));
    expect(answer).toHaveBeenCalledWith(
      new Error(
        'The fetch transport cannot listen: the fetch host owns the ' +
          'request loop. Export fetchHandler() and give it to the host.',
      ),
    );
  },
);

test('listen() answers with the reason instead of waiting', async () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  const app = await NestFactory.create(ProbeModule, adapter, {
    logger: false,
  });
  try {
    let refusal = '';
    try {
      await app.listen(0);
    } catch (error) {
      if (error instanceof Error) refusal = error.message;
    }
    expect(refusal).toContain('fetch host');
  } finally {
    await app.close();
  }
});
