// oxlint-disable-next-line import/no-unassigned-import -- patches Reflect.
import 'reflect-metadata';

import type { Target } from '#benchmarks/harness/config/index';
import { creators } from './creators.ts';

/** Start offset of user arguments in process.argv. */
const ARGV_START = 2;

/** Target argument extracted from CLI invocation. */
const targetArg = process.argv[ARGV_START];

/** Port argument extracted from CLI invocation. */
const portArg = process.argv[ARGV_START + 1];

/** Checks if a string corresponds to a known server creator. */
const isTarget = (value: string | undefined): value is Target =>
  value !== undefined && value in creators;

/** Validates and retrieves the target parameter. */
const readTarget = (): Target => {
  if (!isTarget(targetArg)) {
    throw new Error('the target must be bun, node, express or fastify');
  }
  return targetArg;
};

/** Validates and parses the port parameter. */
const readPort = (): number => {
  const port = Number(portArg);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('the port must be a positive integer');
  }
  return port;
};

/** Main bootstrap function for the standalone server runner. */
const main = async (): Promise<void> => {
  const app = await creators[readTarget()]();
  app.enableCors({ origin: '*' });
  app.useLogger(false);
  await app.listen(readPort(), '127.0.0.1');
  process.stdout.write('BENCH_READY\n');
};

// oxlint-disable-next-line node/no-top-level-await -- standalone child script.
await main();
