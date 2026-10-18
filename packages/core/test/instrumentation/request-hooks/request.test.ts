import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { probeApp } from '#adapter-test/instrumentation/hooks';

test('the request hook reads the request the route will read', async () => {
  const seen: string[] = [];
  const app = probeApp({
    onRequest: (request, _response, done) => {
      seen.push(`${request.method} ${request.originalUrl}`);
      done();
    },
  });
  const response = await app.request('/ping');
  expect(seen).toStrictEqual(['GET /ping']);
  expect(response.status).toBe(HttpStatus.OK);
});
