import type { NestContext } from '#adapter/core/context';
import { reportDisconnect, tuneableSocket } from '#adapter/core/server/socket';
import type { SseResponse } from '#adapter/core/response/sse-stream/index';

import { noStream } from './state.ts';

const recordedHeaders = (context: NestContext): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const [name, value] of context.res.headers) {
    if (name !== 'content-type') record[name] = value;
  }
  return record;
};

const installSurface = (context: NestContext, response: SseResponse): void => {
  Object.defineProperties(context, {
    statusCode: {
      configurable: true,
      get: (): number | undefined => response.statusCode,
    },
    writableEnded: {
      configurable: true,
      get: (): boolean => response.writableEnded,
    },
  });
  Object.assign(context, {
    emit: response.emit.bind(response),
    end: response.end.bind(response),
    flushHeaders: response.flushHeaders.bind(response),
    getHeaders: (): Record<string, string> => recordedHeaders(context),
    on: response.on.bind(response),
    once: response.once.bind(response),
    removeListener: response.removeListener.bind(response),
    setHeader: response.setHeader.bind(response),
    write: response.write.bind(response),
    writeHead: response.writeHead.bind(response),
  });
};

const watchDisconnect = (context: NestContext): (() => void) => {
  const { incoming } = context.env;
  if (incoming === undefined) return noStream;
  const socket = tuneableSocket(incoming.socket);
  const report = (): void => {
    reportDisconnect(socket);
  };
  if (incoming.closed === true) {
    report();
    return report;
  }
  incoming.on('close', report);
  return report;
};

export { installSurface, watchDisconnect };
