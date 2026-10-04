import { execFile } from 'node:child_process';
import { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';

import { expect, test } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { NestApplicationOptions } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import {
  request,
  startAdapter,
  startProbe,
} from './support.ts';

/** What a security header carries when it is sent. */
const NOSNIFF = 'nosniff';

/** The address a proxy claims the request came from. */
const FORWARDED_FOR = '203.0.113.7, 10.0.0.1';

/** The host a proxy claims the request was sent to. */
const FORWARDED_HOST = 'api.example.com';

/** Where the adapter lives, for the check Node runs. */
const SOURCE = `${import.meta.dirname}/../src/core/server-adapter.ts`;

/**
 * A check the runtime itself answers: the server class is read
 * with `instanceof`, so the check runs in a plain Node process
 * rather than inside the test runner, which also shows that the
 * adapter runs on the runtime a deployment uses.
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

function forwarded(): Record<string, string> {
  return {
    'x-forwarded-for': FORWARDED_FOR,
    'x-forwarded-host': FORWARDED_HOST,
    'x-forwarded-proto': 'https',
  };
}

test('a plain server is an HTTP server', async () => {
  const probe = await startProbe();
  try {
    expect(probe.adapter.getHttpServer()).toBeInstanceOf(
      HttpServer,
    );
  } finally {
    await probe.close();
  }
});

test('httpsOptions are served over TLS', async () => {
  const answers = await runNode('node', [
    '--input-type=module',
    '-e',
    TLS_CHECK,
  ]);
  expect(answers).toBe('true,false');
});

test('security headers are sent unless they are turned off', async () => {
  const sent = await startProbe();
  try {
    const response = await request(sent, '/ping');
    expect(response.headers.get('x-content-type-options')).toBe(
      NOSNIFF,
    );
  } finally {
    await sent.close();
  }

  const off = await startProbe({
    adapter: { secureHeaders: false },
  });
  try {
    const response = await request(off, '/ping');
    expect(
      response.headers.get('x-content-type-options'),
    ).toBeNull();
  } finally {
    await off.close();
  }
});

test('forwarded headers are ignored unless a proxy is trusted', async () => {
  const direct = await startProbe();
  try {
    const response = await request(direct, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({
      ips: [],
      protocol: 'http',
      secure: false,
    });
  } finally {
    await direct.close();
  }

  const proxied = await startProbe({
    adapter: { trustProxy: true },
  });
  try {
    const response = await request(proxied, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toStrictEqual({
      hostname: FORWARDED_HOST,
      ip: '203.0.113.7',
      ips: ['203.0.113.7', '10.0.0.1'],
      protocol: 'https',
      secure: true,
    });
  } finally {
    await proxied.close();
  }
});

test('a Hono route registered before listening is served', async () => {
  const adapter = new ServerAdapter();
  adapter
    .getHono()
    .get('/native', (context) => context.text('native'));
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/native');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('native');
  } finally {
    await probe.close();
  }
});

/**
 * The shutdown option Nest 12 added to its application options:
 * Nest 11 does not declare it, and the adapter reads it from
 * whatever object it is handed either way.
 */
type ClosingOptions = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

test('closing an adapter that never listened is not an error', async () => {
  const adapter = new ServerAdapter();
  const options: ClosingOptions = {
    forceCloseConnections: true,
    return503OnClosing: true,
  };
  adapter.initHttpServer(options);
  await adapter.close();
});

test('closing a running adapter twice is not an error', async () => {
  const probe = await startProbe();
  await probe.close();
  await probe.adapter.close();
});
