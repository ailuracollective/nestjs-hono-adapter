/**
 * The Node transport, exercised end to end: injected by name,
 * and picked by the adapter when a deployment names nothing.
 *
 * The rest of the suite runs on the Bun transport the fixture
 * injects, so these cases prove the Node path serves the same
 * application — the same routes, the same response translation,
 * the same shutdown — both ways, and that `getHttpServer()`
 * still answers Node's own server on the default path.
 *
 * The plain `new ServerAdapter()` is not served here.
 * `overrideGlobalObjects` is on by default — which is what
 * every deployment had before the transports split — and
 * `@hono/node-server` replaces the process's `Request` and
 * `Response` when it builds a server, without restoring them.
 * No later case in this process could undo that, so the cases
 * below serve the same default transport with the switch off
 * and pin the wiring without the side effect.
 */

import { execFile } from 'node:child_process';
import { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import { nodeServer } from '../src/servers/node.ts';
import { request } from './probe.ts';
import { startAdapter } from './support.ts';

/** An adapter served through the Node runtime, named by hand. */
function nodeAdapter(): ServerAdapter {
  return new ServerAdapter({ transport: nodeServer() });
}

/** Where the adapter lives, for the check Node runs. */
const SOURCE = `${import.meta.dirname}/../src/core/server-adapter.ts`;

/**
 * A check the runtime itself answers: the server class is read
 * with `instanceof`, so the check runs in a plain Node process
 * rather than inside the test runner, which also shows that the
 * default transport is one Node serves well enough to build
 * with.
 */
const TLS_CHECK = `
const { ServerAdapter } = await import(${JSON.stringify(SOURCE)});
const { Server: HttpsServer } = await import('node:https');
const secure = new ServerAdapter();
secure.initHttpServer({ httpsOptions: {} });
const plain = new ServerAdapter();
plain.initHttpServer({});
const answers = [
  secure.getHttpServer() instanceof HttpsServer,
  plain.getHttpServer() instanceof HttpsServer,
];
process.stdout.write(answers.join(','));
`;

/**
 * Runs a child process and answers what it printed.
 *
 * The callback is declared here rather than left to `execFile`,
 * whose own signature promises a value a caller cannot use.
 */
function execute(
  file: string,
  args: string[],
  done: (error: Error | null, stdout: string) => void,
): void {
  execFile(file, args, done);
}

/**
 * Runs a check in a child process, which is how Node is
 * reached.
 */
const runNode = promisify(execute);

test('the Node transport serves a route', async () => {
  const probe = await startAdapter(nodeAdapter());
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
  } finally {
    await probe.close();
  }
});

test('the Node transport answers a JSON route', async () => {
  const probe = await startAdapter(nodeAdapter());
  try {
    const response = await request(probe, '/request');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('application/json');
  } finally {
    await probe.close();
  }
});

/**
 * The bootstrap that names no runtime is the one every
 * deployment wrote before the transports split, and it has to
 * keep working: the adapter picks the Node transport itself,
 * and `getHttpServer()` answers Node's own server, so the
 * members a deployment reached for are still there.
 */
test('an adapter that names no transport serves through Node', async () => {
  const adapter = new ServerAdapter({
    overrideGlobalObjects: false,
  });
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
    const server = adapter.getHttpServer();
    expect(server).toBeInstanceOf(HttpServer);
    expect(typeof server.closeAllConnections).toBe('function');
    expect(server.address()).not.toBeNull();
  } finally {
    await probe.close();
  }
});

/**
 * The transport the adapter picks itself is the Node one: it
 * carries no websocket helper, which is what sends the `/ws`
 * island to `@hono/node-ws`.
 */
test('an adapter that names no transport picks the Node one', () => {
  const adapter = new ServerAdapter();
  expect(
    adapter.getTransport().createWebSocket,
  ).toBeUndefined();
});

test('an explicit undefined transport still builds a Node server', async () => {
  const answer = await runNode('node', [
    '--input-type=module',
    '-e',
    `
const { ServerAdapter } = await import(${JSON.stringify(SOURCE)});
const { Server: HttpServer } = await import('node:http');
const originalRequest = globalThis.Request;
const adapter = new ServerAdapter({
  transport: undefined,
  overrideGlobalObjects: false,
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

/**
 * The options that are not a transport are read on the default
 * path too, because the transport the adapter picks itself is
 * handed them.
 */
test('the options that are not a transport are still read', async () => {
  const probe = await startAdapter(
    new ServerAdapter({
      overrideGlobalObjects: false,
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

/**
 * TLS is selected by the options Nest hands the adapter, as it
 * always was: an adapter started with `httpsOptions` builds
 * Node's HTTPS server, and one started without them builds the
 * plain server.
 */
test('httpsOptions select the HTTPS server', async () => {
  const answers = await runNode('node', [
    '--input-type=module',
    '-e',
    TLS_CHECK,
  ]);
  expect(answers).toBe('true,false');
});
