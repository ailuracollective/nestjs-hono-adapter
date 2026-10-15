/* eslint-disable typescript/no-unsafe-type-assertion -- adapting Node's own server needs the narrow casts this repository forbids elsewhere. */

import type { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';

import type { Server } from '#adapter/core/ports/server';

const isNotRunning = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ERR_SERVER_NOT_RUNNING';

type CloseCallback = (error?: Error) => void;

interface Listenable {
  listen: (
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ) => void;
}

const adaptListen = (native: HttpServer): void => {
  const server = native as unknown as Listenable;
  server.listen = (port, hostnameOrCallback, callback): void => {
    const args: unknown[] = [port];
    if (hostnameOrCallback !== undefined) args.push(hostnameOrCallback);
    if (callback !== undefined) args.push(callback);
    // Looked up per call: a serverless host replaces http.Server.prototype.listen to capture the
    // server and puts the real one back before the listen that binds, which a bound copy misses.
    const inherited = Object.getPrototypeOf(native) as Listenable;
    Reflect.apply(inherited.listen, native, args);
  };
};

const adaptClose = (native: HttpServer): void => {
  const close = native.close.bind(native);
  const server = native as unknown as {
    close: (closeActiveConnections?: boolean | CloseCallback) => Promise<void>;
  };
  server.close = async (closeActiveConnections = false): Promise<void> => {
    if (typeof closeActiveConnections === 'function') {
      const answer = closeActiveConnections;
      // oxlint-disable-next-line promise/avoid-new -- a Node caller's callback is settled from outside this body, which is what a deferred is; an `async` form would resolve before it answers.
      await new Promise<void>((resolve) => {
        close((error?: Error) => {
          answer(error);
          resolve();
        });
      });
      return;
    }
    if (closeActiveConnections && typeof native.closeAllConnections === 'function')
      native.closeAllConnections();
    try {
      await promisify((done: () => void) => {
        close(done);
      })();
    } catch (error) {
      if (!isNotRunning(error)) {
        throw error;
      }
    }
  };
};

const asServer = (native: HttpServer): Server => {
  adaptListen(native);
  adaptClose(native);
  return native as unknown as Server;
};

export { asServer };
