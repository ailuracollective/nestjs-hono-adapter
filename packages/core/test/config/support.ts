/* eslint-disable node/no-process-env */

import type { Probe, ProbeOptions } from '#test/probe';
import { startProbe } from '#test/probe';

const APP_NAME = 'hono-adapter-fixture';

/** The port the same file gives it, as it is written there. */
const APP_PORT = '8080';

/** The greeting the expansion file writes from the name. */
const APP_GREETING = `hello from ${APP_NAME}`;

/** The greeting as the file writes it, unexpanded. */
// oxlint-disable-next-line eslint/no-template-curly-in-string -- the point of the string is that it does not interpolate.
const APP_GREETING_WRITTEN = 'hello from ${APP_NAME}';

/** What the registered slice answers with. */
const DATABASE = { host: 'db.internal', port: 5432 };

/** The environment a case starts from. */
let untouched: NodeJS.ProcessEnv = {};

/** The environment as it stands, as a copy of its own. */
const environment = (): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env));

/** Puts the environment back the way a case found it. */
const restore = (previous: NodeJS.ProcessEnv): void => {
  process.env = previous;
};

/** Remembers the environment a case starts from. */
const snapshotEnvironment = (): void => {
  untouched = environment();
};

/** Puts the environment back to the last snapshot. */
const restoreEnvironment = (): void => {
  restore(untouched);
};

/** Starts an application and restores the environment. */
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
