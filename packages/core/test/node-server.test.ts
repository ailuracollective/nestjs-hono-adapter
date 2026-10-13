/**
 * The Node transport, exercised end to end, always injected by
 * name: the adapter's default is the Bun transport, so no case
 * here relies on it.
 *
 * The rest of the suite runs on the Bun transport the fixture
 * injects, so these cases prove the Node path serves the same
 * application — the same routes, the same response translation,
 * the same shutdown — and that `getHttpServer()` answers Node's
 * own server when `nodeServer()` is the transport named.
 *
 * `overrideGlobalObjects` stays off throughout: it is the
 * switch that replaces the process's `Request` and `Response`,
 * and `@hono/node-server` never restores them, so no later case
 * in this process could undo it. The one case that needs it
 * lives in `isolation.test.ts`.
 */

import { execFile } from 'node:child_process';
import { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import { nodeServer } from '../src/servers/node.ts';
import { request } from '../../../test/probe.ts';
import { startAdapter } from './support.ts';

/** An adapter served through the Node runtime, named by hand. */
function nodeAdapter(): ServerAdapter {
  return new ServerAdapter({ transport: nodeServer() });
}

/**
 * Where the adapter and the Node transport live, for the checks
 * Node runs.
 */
const ADAPTER_SOURCE = `${import.meta.dirname}/../src/index.ts`;
const NODE_SOURCE = `${import.meta.dirname}/../src/servers/node.ts`;

/**
 * A check the runtime itself answers: the server class is read
 * with `instanceof`, and only Node tells an HTTPS server from a
 * plain one, so the check runs in a plain Node process rather
 * than inside the test runner. It imports the adapter itself,
 * which loads under Node now that the Bun transport resolves
 * `hono/bun` only where the Bun global exists, and reads
 * `initHttpServer` there: the `httpsOptions` Nest hands it are
 * forwarded to the transport, which is what selects the HTTPS
 * server.
 */
const TLS_CHECK = `
const { ServerAdapter } = await import(${JSON.stringify(ADAPTER_SOURCE)});
const { nodeServer } = await import(${JSON.stringify(NODE_SOURCE)});
const { Server: HttpsServer } = await import('node:https');
const secure = new ServerAdapter({ transport: nodeServer() });
secure.initHttpServer({ httpsOptions: {} });
const plain = new ServerAdapter({ transport: nodeServer() });
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
 * `getHttpServer()` answers Node's own server on this
 * transport, so the members a deployment reached for are still
 * there.
 */
test("the Node transport answers Node's own server", async () => {
  const adapter = nodeAdapter();
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

test('an undefined transport is answered by the default and keeps the other options', async () => {
  const options = {
    trustProxy: true,
  };
  // JavaScript callers can explicitly leave the transport undefined.
  Reflect.set(options, 'transport', undefined);
  const adapter = new ServerAdapter(options);
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/request', {
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(response.body).toMatchObject({ ip: '203.0.113.7' });
  } finally {
    await probe.close();
  }
});

/**
 * The Node transport carries no websocket helper, which is what
 * sends the `/ws` island to `@hono/node-ws`.
 */
test('the Node transport carries no websocket helper', () => {
  const adapter = nodeAdapter();
  expect(
    adapter.getTransport().createWebSocket,
  ).toBeUndefined();
});

/**
 * `overrideGlobalObjects` is off unless a deployment asks for
 * it, so the transport replaces nothing. Read under plain Node
 * for the same reason as the TLS check above, and through
 * `initHttpServer`, which is where the adapter builds the
 * server.
 */
test('the Node transport leaves the global objects alone by default', async () => {
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
 * TLS is selected by the options Nest hands the transport: a
 * server started with `httpsOptions` is Node's HTTPS server,
 * and one started without them is the plain server.
 */
test('httpsOptions select the HTTPS server', async () => {
  const answers = await runNode('node', [
    '--input-type=module',
    '-e',
    TLS_CHECK,
  ]);
  expect(answers).toBe('true,false');
});
