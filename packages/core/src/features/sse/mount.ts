/* eslint-disable typescript/no-unsafe-type-assertion */

import type { NestContext } from '#adapter/core/context';
import { SseResponse } from '#adapter/core/response/sse-stream/index';

import {
  RAW_STATE,
  installedOn,
  startWaiter,
} from './state.ts';
import type { SseHolder } from './state.ts';
import { installSurface, watchDisconnect } from './surface.ts';

/** Defines the raw getter on the context prototype, once. */
const installRawGetter = (context: NestContext): void => {
  const prototype = Object.getPrototypeOf(
    context,
  ) as unknown as object;
  if (installedOn.has(prototype)) {
    return;
  }
  installedOn.add(prototype);
  Object.defineProperty(prototype, 'raw', {
    configurable: true,
    get(this: NestContext): SseResponse {
      const holder = this as unknown as SseHolder;
      const state = holder[RAW_STATE];
      if (state === undefined) {
        throw new TypeError(
          'An event stream was asked for on a response this adapter did not mount one on.',
        );
      }
      if (state.opened === undefined) {
        const report = watchDisconnect(this);
        state.opened = new SseResponse(state.status, {
          onCommit: (answer): void => {
            this.res = answer;
          },
          onDisconnect: report,
          signal: state.waiter.settle,
        });
        installSurface(this, state.opened);
      }
      return state.opened;
    },
  });
};

/** Opens an event stream and answers when it starts. */
const mountSse = (
  context: NestContext,
  status: () => number | undefined,
): Promise<unknown> => {
  installRawGetter(context);
  const waiter = startWaiter();
  const holder = context as unknown as SseHolder;
  holder[RAW_STATE] = { opened: undefined, status, waiter };
  return waiter.started;
};

export { mountSse };
