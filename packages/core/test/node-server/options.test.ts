import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '#adapter/index';
import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { ADAPTER_SOURCE, NODE_SOURCE, TLS_CHECK, nodeAdapter, runNode } from './fixture.ts';

test('the Node transport carries no websocket helper', () => {
  const adapter = nodeAdapter();
  expect(adapter.getTransport().createWebSocket).toBeUndefined();
});

test('the Node transport swaps the global objects by default', async () => {
  const answer = await runNode('node', [
    '--input-type=module',
    '-e',
    `
const { ServerAdapter } = await import(${JSON.stringify(ADAPTER_SOURCE)});
const { nodeServer } = await import(${JSON.stringify(NODE_SOURCE)});
const { Server: HttpServer } = await import('node:http');
const originalRequest = globalThis.Request;
const adapter = new ServerAdapter({ transport: nodeServer() });
adapter.initHttpServer({});
process.stdout.write(String(
  adapter.getHttpServer() instanceof HttpServer &&
  globalThis.Request !== originalRequest
));
`,
  ]);
  expect(answer).toBe('true');
});

test('overrideGlobalObjects false leaves the global objects alone', async () => {
  const answer = await runNode('node', [
    '--input-type=module',
    '-e',
    `
const { ServerAdapter } = await import(${JSON.stringify(ADAPTER_SOURCE)});
const { nodeServer } = await import(${JSON.stringify(NODE_SOURCE)});
const { Server: HttpServer } = await import('node:http');
const originalRequest = globalThis.Request;
const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
});
adapter.initHttpServer({});
process.stdout.write(String(
  adapter.getHttpServer() instanceof HttpServer &&
  globalThis.Request === originalRequest
));
`,
  ]);
  expect(answer).toBe('true');
});

test('the options that are not a transport are still read', async () => {
  const probe = await startAdapter(
    new ServerAdapter({
      trustProxy: true,
    }),
  );
  try {
    const response = await request(probe, '/request');
    expect(response.status).toBe(HttpStatus.OK);
  } finally {
    await probe.close();
  }
});

test('httpsOptions select the HTTPS server', async () => {
  const answers = await runNode('node', ['--input-type=module', '-e', TLS_CHECK]);
  expect(answers).toBe('true,false');
});
