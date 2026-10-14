import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import {
  ProbeModule,
  SseModule,
} from '#adapter-test/support/index';
import { startFetch } from './support.ts';

test('a route answers through the fetch handler', async () => {
  const probe = await startFetch(ProbeModule);
  try {
    const ping = await probe.fetch(
      new Request('http://host.test/ping'),
    );
    expect(ping.status).toBe(HttpStatus.OK);

    const echo = await probe.fetch(
      new Request('http://host.test/echo', {
        body: JSON.stringify({ ping: true }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );
    expect(echo.status).toBe(HttpStatus.CREATED);
    expect(await echo.json()).toStrictEqual({ ping: true });
  } finally {
    await probe.close();
  }
});

test('a stream answers through the fetch handler', async () => {
  const probe = await startFetch(SseModule);
  try {
    const stream = await probe.fetch(
      new Request('http://host.test/sse/open'),
    );
    expect(stream.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    if (stream.body !== null) {
      await stream.body.cancel();
    }
  } finally {
    await probe.close();
  }
});
