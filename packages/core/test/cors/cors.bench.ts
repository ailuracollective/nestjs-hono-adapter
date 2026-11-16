import assert from 'node:assert/strict';
import { Hono } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import { corsBridge } from '#adapter/features/cors/index';

const REQUESTS = 200_000;
const WARMUP = 10_000;
const NO_CONTENT = 204;
const options = { origin: '*' };
const app = new Hono<NestEnv>();
app.use(
  '*',
  corsBridge(
    () => options,
    () => false,
  ),
);
const request = new Request('http://localhost/', {
  headers: { 'access-control-request-method': 'GET', origin: 'https://example.com' },
  method: 'OPTIONS',
});

/** A preflight stops before Nest: this isolates static CORS scheduling and response work. */
const run = async (count: number): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- sequential requests measure the same completed path.
    const response = await app.fetch(request);
    assert.equal(response.status, NO_CONTENT);
  }
};

const main = async (): Promise<void> => {
  await run(WARMUP);
  if (globalThis.gc !== undefined) globalThis.gc();
  const cpu = process.cpuUsage();
  const start = performance.now();
  await run(REQUESTS);
  process.stdout.write(
    `${JSON.stringify({ cpu: process.cpuUsage(cpu), elapsedMs: performance.now() - start, requests: REQUESTS })}\n`,
  );
};

// oxlint-disable-next-line node/no-top-level-await -- finite CORS microbenchmark.
await main();
