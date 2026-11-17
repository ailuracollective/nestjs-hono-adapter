import assert from 'node:assert/strict';
import { Context } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import { whenResponseSettled } from '#adapter/core/response/response-helpers';

const REQUESTS = 500_000;
const WARMUP = 10_000;
const request = new Request('http://localhost/');
const response = new Response();

/** The same immutable inputs isolate context preparation from payload allocation. */
const run = async (count: number): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    const context = new Context<NestEnv>(request);
    const settled = whenResponseSettled(context);
    context.res = response;
    // oxlint-disable-next-line no-await-in-loop -- every response must settle before the next sample.
    await settled;
    assert.equal(context.res, response);
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

// oxlint-disable-next-line node/no-top-level-await -- finite microbenchmark entrypoint.
await main();
