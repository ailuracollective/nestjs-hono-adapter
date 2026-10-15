/* eslint-disable node/no-process-env */

import type { Probe, ProbeOptions } from '#test/probe';
import { startProbe } from '#test/probe';

const APP_NAME = 'hono-adapter-fixture';

const APP_PORT = '8080';

const APP_GREETING = `hello from ${APP_NAME}`;

// oxlint-disable-next-line eslint/no-template-curly-in-string -- the point of the string is that it does not interpolate.
const APP_GREETING_WRITTEN = 'hello from ${APP_NAME}';

const DATABASE = { host: 'db.internal', port: 5432 };

let untouched: NodeJS.ProcessEnv = {};

const environment = (): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(process.env));

const restore = (previous: NodeJS.ProcessEnv): void => {
  process.env = previous;
};

const snapshotEnvironment = (): void => {
  untouched = environment();
};

const restoreEnvironment = (): void => {
  restore(untouched);
};

const withProbe = async <Answer>(
  options: ProbeOptions,
  read: (probe: Probe) => Answer | Promise<Answer>,
): Promise<Answer> => {
  const probe = await startProbe(options);
  try {
    return await Promise.resolve(read(probe));
  } finally {
    await probe.close();
    restore(untouched);
  }
};

export {
  APP_GREETING,
  APP_GREETING_WRITTEN,
  APP_NAME,
  APP_PORT,
  DATABASE,
  restoreEnvironment,
  snapshotEnvironment,
  withProbe,
};
