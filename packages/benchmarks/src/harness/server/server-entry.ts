// oxlint-disable-next-line import/no-unassigned-import -- patches Reflect.
import 'reflect-metadata';
// oxlint-disable-next-line import/no-unassigned-import -- patches the stock Inertia module for Hono.
import '@ailura/nestjs-platform-hono-inertia/register';

import type { Type } from '@nestjs/common';

import { BaseModule } from '#benchmarks/app/base.module';
import { BenchModule } from '#benchmarks/app/bench.module';
import type { App, Target } from '#benchmarks/harness/config/index';
import { creators } from './creators.ts';

/** Start offset of user arguments in process.argv. */
const ARGV_START = 2;

/** Target, port and application arguments extracted from the CLI invocation. */
const [targetArg, portArg, appArg] = process.argv.slice(ARGV_START);

/** Checks if a string corresponds to a known server creator. */
const isTarget = (value: string | undefined): value is Target =>
  value !== undefined && value in creators;

/** Checks if a string corresponds to a known application variant. */
const isApp = (value: string | undefined): value is App => value === 'base' || value === 'inertia';

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

/** Validates and retrieves the application variant, defaulting to Inertia. */
const readApp = (): App => (isApp(appArg) ? appArg : 'inertia');

/** Chooses the Nest module for the requested application variant. */
const readModule = (): Type<unknown> => (readApp() === 'base' ? BaseModule : BenchModule);

/** Main bootstrap function for the standalone server runner. */
const main = async (): Promise<void> => {
  const app = await creators[readTarget()](readModule());
  app.enableCors({ origin: '*' });
  app.useLogger(false);
  await app.listen(readPort(), '127.0.0.1');
  process.stdout.write('BENCH_READY\n');
};

// oxlint-disable-next-line node/no-top-level-await -- standalone child script.
await main();
