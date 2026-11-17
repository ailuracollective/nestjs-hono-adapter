// oxlint-disable-next-line import/no-unassigned-import -- Nest reads decorator metadata.
import 'reflect-metadata';

import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

import { BaseModule } from '#benchmarks/app/base.module';

const DEFAULT_REQUESTS = 100_000;
const WARMUP_REQUESTS = 10_000;
const EXPECTED_STATUS = 200;
const ARGV_START = 2;
const [path = '/hello', count = String(DEFAULT_REQUESTS), heapPath] =
  process.argv.slice(ARGV_START);
const requests = Number(count);
assert.ok(Number.isSafeInteger(requests) && requests > 0, 'request count must be positive');
assert.ok(path.startsWith('/'), 'path must start with /');

const runRequests = async (adapter: ServerAdapter, total: number): Promise<void> => {
  const url = `http://localhost${path}`;
  for (let index = 0; index < total; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- sequential requests isolate per-request work.
    const response = await adapter.getHono().fetch(new Request(url));
    assert.equal(response.status, EXPECTED_STATUS);
    // oxlint-disable-next-line no-await-in-loop -- drain streams before measuring the next request.
    await response.arrayBuffer();
  }
};

const snapshot = async (): Promise<void> => {
  if (heapPath === undefined) return;
  if (process.versions.bun) {
    const { generateHeapSnapshot } = await import('bun');
    await writeFile(heapPath, JSON.stringify(generateHeapSnapshot()));
  } else {
    const { writeHeapSnapshot } = await import('node:v8');
    writeHeapSnapshot(heapPath);
  }
};

const measure = async (adapter: ServerAdapter): Promise<void> => {
  if (globalThis.gc !== undefined) globalThis.gc();
  const before = process.memoryUsage();
  const cpu = process.cpuUsage();
  const start = performance.now();
  await runRequests(adapter, requests);
  const elapsedMs = performance.now() - start;
  const used = process.cpuUsage(cpu);
  if (globalThis.gc !== undefined) globalThis.gc();
  process.stdout.write(
    `${JSON.stringify({ before, cpu: used, elapsedMs, memory: process.memoryUsage(), path, requests })}\n`,
  );
};

/** Runs finite, in-process requests so runtime profilers can flush on normal exit. */
const main = async (): Promise<void> => {
  const adapter = new ServerAdapter({ transport: fetchServer() });
  const app = await NestFactory.create(BaseModule, adapter, { logger: false });
  app.enableCors({ origin: '*' });
  await app.init();
  try {
    await runRequests(adapter, WARMUP_REQUESTS);
    await measure(adapter);
    await snapshot();
  } finally {
    await app.close();
  }
};

// oxlint-disable-next-line node/no-top-level-await -- finite profiling entrypoint.
await main();
