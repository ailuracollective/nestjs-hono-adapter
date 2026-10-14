import { Command } from 'commander';

import {
  addExecutionOptions,
  addMeasurementOptions,
} from './options.ts';

/** No-op stream writer to suppress default stdout output. */
const silentWrite = (): void => undefined;

/** Constructs and configures the Commander benchmark program. */
const buildProgram = (): Command => {
  const program = new Command();
  program
    .name('bun dist/harness/run.js')
    .usage('[options]')
    .exitOverride()
    .configureOutput({
      writeOut: silentWrite,
    });
  addExecutionOptions(program);
  addMeasurementOptions(program);
  return program;
};

export { buildProgram };
