import { NestFactory } from '@nestjs/core';
import type { Type } from '@nestjs/common';

import type { ServerAdapter } from '#adapter/index';
import {
  ANY_PORT,
  IN_PROCESS_ENV,
  LOCALHOST,
  applicationOptions,
  originOf,
  restoreWebClasses,
} from '#test/probe/in-process';
import { IN_PROCESS_MODE, SOCKET_MODE } from '#test/probe/types';
import type { Probe, ProbeOptions } from '#test/probe/types';

const startApplication = async (
  adapter: ServerAdapter,
  module: Type<unknown>,
  options: ProbeOptions = {},
): Promise<Probe> => {
  const app = await NestFactory.create(module, adapter, applicationOptions(options.application));
  if (options.configure !== undefined) options.configure(app);
  if (options.mode === IN_PROCESS_MODE) {
    await app.init();
    return {
      adapter,
      app,
      close: () => app.close(),
      mode: IN_PROCESS_MODE,
      respond: (path, init) => {
        restoreWebClasses();
        return Promise.resolve(adapter.getHono().request(path, init, IN_PROCESS_ENV));
      },
    };
  }
  await app.listen(ANY_PORT, LOCALHOST);
  const origin = originOf(adapter);
  return {
    adapter,
    app,
    close: () => app.close(),
    mode: SOCKET_MODE,
    respond: (path, init) => {
      restoreWebClasses();
      return fetch(`${origin}${path}`, init);
    },
  };
};

export { startApplication };
