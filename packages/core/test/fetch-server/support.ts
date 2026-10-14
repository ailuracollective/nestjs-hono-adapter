import { NestFactory } from '@nestjs/core';

import type { Type } from '@nestjs/common';

import {
  fetchHandler,
  fetchServer,
} from '#adapter/servers/fetch';
import type { FetchHandlerOptions } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';
import type { TrustProxy } from '#adapter/index';

/** A running application answered through the fetch handler. */
interface FetchProbe {
  readonly fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}

/** Starts one module on the fetch transport. */
const startFetch = async (
  module: Type<unknown>,
  handler: FetchHandlerOptions = {},
  trustProxy: TrustProxy = false,
): Promise<FetchProbe> => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
    trustProxy,
  });
  const app = await NestFactory.create(module, adapter, {
    logger: false,
  });
  await app.init();
  return {
    close: () => app.close(),
    fetch: fetchHandler(adapter.getHono(), handler),
  };
};

export { startFetch };
