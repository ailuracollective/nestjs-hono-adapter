/**
 * The cases that show `@nestjs/config` works on this adapter.
 *
 * The shapes under test are the ones the official suite covers,
 * and the claim each one makes is the same: the configuration
 * the module loaded reaches the container, and a value read out
 * of it survives the round trip through a route handler and
 * back as an answer. What the adapter is asked for is only that
 * the value arrives — the loading belongs to `@nestjs/config`.
 *
 * This file writes to `process.env` throughout, which the rest
 * of the suite has no reason to do: reading what the process
 * holds is what the module under test is for, and a case cannot
 * show a variable being cached, skipped or shadowed without
 * setting one.
 */

import { beforeEach, expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  configured,
  databaseConfig,
  requireAppName,
  withCache,
  withEnvFile,
  withExpandedEnvFile,
  withRejectedConfig,
  withRegisteredSlice,
  withSkipProcessEnv,
  withTransformingValidate,
  withUnexpandedEnvFile,
  withValidate,
  withValidationSchema,
} from './config-fixture.ts';

import type { Probe, ProbeOptions } from './probe.ts';
import { request, startProbe } from './probe.ts';

/** The name the environment files give the application. */
const APP_NAME = 'hono-adapter-fixture';

/** The port the same file gives it, as it is written there. */
const APP_PORT = '8080';

/** The greeting the expansion file writes in terms of the name. */
const APP_GREETING = `hello from ${APP_NAME}`;

/**
 * The greeting as the file writes it, before anything expands
 * it.
 */
// The reference is a literal here: it is what the file holds, and a
// template literal would have this string interpolate at the point
// it is declared rather than carry the text through to a comparison.
// oxlint-disable-next-line eslint/no-template-curly-in-string -- the point of the string is that it does not interpolate.
const APP_GREETING_WRITTEN = 'hello from ${APP_NAME}';

/** What the registered slice answers with. */
const DATABASE = { host: 'db.internal', port: 5432 };

/**
 * The environment a case starts from, held so a case that
 * writes to it hands the next one back what it found. `forRoot`
 * writes what it loads into `process.env` on every application
 * it builds, so without this a case would inherit the last
 * one's.
 */
let untouched: NodeJS.ProcessEnv = {};

/**
 * Reads the environment as it stands, as a copy of its own.
 *
 * The copy is the point: `process.env` hands out the live
 * object, so holding a reference to it would make the snapshot
 * a view of whatever came next rather than what was found.
 */
function environment(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env));
}

/** Puts the environment back the way a case found it. */
function restore(previous: NodeJS.ProcessEnv): void {
  process.env = previous;
}

beforeEach(() => {
  untouched = environment();
});

/**
 * Starts an application, hands it to the case, and puts both
 * the application and the environment back the way they were.
 *
 * The reader is allowed to answer without awaiting anything: a
 * case that only reads from the container has nothing to wait
 * for, and writing `async` where nothing is awaited is a claim
 * the code does not make.
 */
async function withProbe<Answer>(
  options: ProbeOptions,
  read: (probe: Probe) => Answer | Promise<Answer>,
): Promise<Answer> {
  const probe = await startProbe(options);
  try {
    return await Promise.resolve(read(probe));
  } finally {
    await probe.close();
    restore(untouched);
  }
}

test('a variable loaded from a file reaches a route', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    const response = await request(
      probe,
      '/config/env/APP_NAME',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_NAME);
  });
});

test('every variable of the file is loaded, not only the first', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    const response = await request(
      probe,
      '/config/env/APP_PORT',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_PORT);
  });
});

test('a key nothing loaded is answered as absent', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    const response = await request(
      probe,
      '/config/env/APP_MISSING',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('');
  });
});

test('a variable is left as written when expansion is not asked for', async () => {
  await withProbe(
    configured(withUnexpandedEnvFile()),
    async (probe) => {
      const response = await request(
        probe,
        '/config/env/APP_GREETING',
      );
      expect(response.text).toBe(APP_GREETING_WRITTEN);
    },
  );
});

test('expansion resolves a variable written in terms of another', async () => {
  await withProbe(
    configured(withExpandedEnvFile()),
    async (probe) => {
      const response = await request(
        probe,
        '/config/env/APP_GREETING',
      );
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toBe(APP_GREETING);
    },
  );
});

test('a registered slice reaches the constructor that asked for it', async () => {
  await withProbe(
    configured(withRegisteredSlice()),
    async (probe) => {
      const response = await request(probe, '/slice/database');
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toStrictEqual(DATABASE);
    },
  );
});

test('a registered slice is readable by name through the service', async () => {
  const read = await withProbe(
    configured(withRegisteredSlice()),
    (probe) => {
      const config = probe.app.get(ConfigService);
      return {
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
      };
    },
  );

  expect(read).toStrictEqual(DATABASE);
});

test('the registered slice names itself with a token forFeature uses', () => {
  expect(databaseConfig.KEY).toBeDefined();
  expect(databaseConfig()).toStrictEqual(DATABASE);
});

test('a cached configuration keeps the value it was loaded with', async () => {
  await withProbe(configured(withCache()), async (probe) => {
    process.env.APP_NAME = 'before-the-start';
    const before = await request(probe, '/config/env/APP_NAME');
    expect(before.body).toBe('before-the-start');

    process.env.APP_NAME = 'after-the-start';
    const after = await request(probe, '/config/env/APP_NAME');
    expect(after.body).toBe('before-the-start');
  });
});

test('an uncached configuration reads the environment again', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    process.env.APP_NAME = 'before-the-start';
    const before = await request(probe, '/config/env/APP_NAME');
    expect(before.body).toBe('before-the-start');

    process.env.APP_NAME = 'after-the-start';
    const after = await request(probe, '/config/env/APP_NAME');
    expect(after.body).toBe('after-the-start');
  });
});

test('the process is not answered for when it is told to be skipped', async () => {
  await withProbe(
    configured(withSkipProcessEnv()),
    async (probe) => {
      process.env.APP_NAME = 'from-the-process';

      const response = await request(
        probe,
        '/config/env/APP_NAME',
      );
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.text).toBe('');
    },
  );
});

test('a configuration that passes its validate function is loaded', async () => {
  await withProbe(configured(withValidate()), async (probe) => {
    const response = await request(
      probe,
      '/config/env/APP_NAME',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_NAME);
  });
});

test('the validate function rejects a configuration that loaded nothing', () => {
  expect(() => requireAppName({})).toThrow(
    'APP_NAME was not loaded',
  );
});

test('a rejected configuration stops the application from starting', async () => {
  // `abortOnError` is off because its default takes the process down
  // with it, which would take the suite with it: what the case is
  // about is the rejection arriving as a failure to start, not the
  // process that carried it.
  const options: ProbeOptions = Object.assign(
    configured(withRejectedConfig()),
    { application: { abortOnError: false } },
  );

  let reason = '';
  try {
    await startProbe(options);
  } catch (error: unknown) {
    reason = String(error);
  }

  expect(reason).toContain('the configuration was rejected');
  restore(untouched);
});

test('a validate function transforms what it lets through', async () => {
  const port = await withProbe(
    configured(withTransformingValidate()),
    (probe) =>
      probe.app.get(ConfigService).get<number>('APP_PORT'),
  );

  expect(port).toBe(Number(APP_PORT));
});

test('a schema keeps the variables it did not declare', async () => {
  await withProbe(
    configured(withValidationSchema()),
    async (probe) => {
      const name = await request(probe, '/config/env/APP_NAME');
      expect(name.body).toBe(APP_NAME);

      const port = await request(probe, '/config/env/APP_PORT');
      expect(port.body).toBe(APP_PORT);
    },
  );
});

test('a loaded configuration answers over a real connection', async () => {
  await withProbe(
    configured(withEnvFile(), 'socket'),
    async (probe) => {
      const response = await request(
        probe,
        '/config/env/APP_NAME',
      );
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.text).toBe(APP_NAME);
    },
  );
});

test('a registered slice answers over a real connection', async () => {
  await withProbe(
    configured(withRegisteredSlice(), 'socket'),
    async (probe) => {
      const response = await request(probe, '/slice/database');
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toStrictEqual(DATABASE);
    },
  );
});
