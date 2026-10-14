import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import {
  MarkerFilter,
  startProbe,
} from '#adapter-test/support/index';
import { request } from '#test/probe';

test('a malformed body is answered by the exception layer', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useGlobalFilters(new MarkerFilter());
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/echo', {
      body: '{"broken":',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.headers.get('x-filtered')).toBe('yes');
    expect(response.body).toStrictEqual({
      status: HttpStatus.BAD_REQUEST,
    });
  } finally {
    await probe.close();
  }
});
