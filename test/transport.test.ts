import { execFile } from 'node:child_process';
import { Server as HttpServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { promisify } from 'node:util';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import type { NestApplicationOptions } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import type { NestRequest } from '../src/index.ts';
import { request } from './probe.ts';
import { startAdapter, startProbe } from './support.ts';

/**
 * The hook Nest's built-in security features register, as the
 * base class types it: the request it reads and the raw
 * response it writes.
 */
type SecurityHook = (
  request: NestRequest,
  response: ServerResponse,
) => unknown;

/**
 * The hook the adapter installed, read off its own property.
 * Nest 12.0.3 has no feature that registers it yet, so a case
 * that wants one reads it the way a Nest that declares the hook
 * would reach it. The adapter installs it as an own property
 * rather than declaring the method, which is what this read
 * depends on.
 */
function securityHookOf(
  adapter: ServerAdapter,
): (hook: SecurityHook) => void {
  const installed: unknown = Reflect.get(
    adapter,
    'registerSecurityHook',
  );
  if (typeof installed !== 'function') {
    throw new TypeError(
      'The adapter did not install the security hook.',
    );
  }
  return (hook: SecurityHook): void => {
    Reflect.apply(installed, adapter, [hook]);
  };
}

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

test('a hop count trusts that many addresses from the right', async () => {
  const one = await startProbe({ adapter: { trustProxy: 1 } });
  try {
    const response = await request(one, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '10.0.0.1' });
  } finally {
    await one.close();
  }

  const both = await startProbe({ adapter: { trustProxy: 2 } });
  try {
    const response = await request(both, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '203.0.113.7' });
  } finally {
    await both.close();
  }
});

/**
 * A trust list is walked from the right, and the socket's own
 * address is one of the addresses it may name: a list that
 * leaves it out stops at the loopback address, which is the
 * rule proxy-addr walks by.
 */
test('a trust list is walked from the right, the socket included', async () => {
  const withoutSocket = await startProbe({
    adapter: { trustProxy: ['10.0.0.1'] },
  });
  try {
    const response = await request(withoutSocket, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '127.0.0.1' });
  } finally {
    await withoutSocket.close();
  }

  const chain = await startProbe({
    adapter: { trustProxy: ['127.0.0.1', '10.0.0.1'] },
  });
  try {
    const response = await request(chain, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '203.0.113.7' });
  } finally {
    await chain.close();
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
 * The hook Nest's built-in security features register is
 * answered in front of every route: the headers it sets on the
 * raw response reach the answer whatever the route returned,
 * which is the merge the Fastify adapter relies on too. A
 * failure it reports belongs to the exception layer's path
 * rather than to the route's.
 */
test('the security hook runs in front of every route', async () => {
  const adapter = new ServerAdapter();
  securityHookOf(adapter)((_request, response) => {
    response.setHeader('x-hook', 'ran');
  });
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('x-hook')).toBe('ran');
  } finally {
    await probe.close();
  }
});

test('a failure the security hook reports is answered by Nest', async () => {
  const adapter = new ServerAdapter();
  securityHookOf(adapter)(() => new Error('hook refused'));
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
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
