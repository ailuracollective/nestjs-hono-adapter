/* eslint-disable typescript/no-unsafe-type-assertion -- adapting Node's own server needs the narrow casts this repository forbids elsewhere. */

import type { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';

import type { Server } from '#adapter/core/ports/server';

/** Says whether a close failure only means the server never ran. */
const isNotRunning = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ERR_SERVER_NOT_RUNNING';

/** The callback Node's own `close` answers through. */
type CloseCallback = (error?: Error) => void;

/** The `listen` shapes Nest drives a server with. */
interface Listenable {
  listen: (
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ) => void;
}

/** Replaces `listen` with a form that takes every shape. */
const adaptListen = (native: HttpServer): void => {
  const listen = native.listen.bind(native);
  const server = native as unknown as Listenable;
  server.listen = (
    port,
    hostnameOrCallback,
    callback,
  ): void => {
    const args: unknown[] = [port];
    if (hostnameOrCallback !== undefined) {
      args.push(hostnameOrCallback);
    }
    if (callback !== undefined) {
      args.push(callback);
    }
    Reflect.apply(listen, undefined, args);
  };
};

/** Replaces `close` with a promise the port answers through. */
const adaptClose = (native: HttpServer): void => {
  const close = native.close.bind(native);
  const server = native as unknown as {
    close: (
      closeActiveConnections?: boolean | CloseCallback,
    ) => Promise<void>;
  };
  server.close = async (
    closeActiveConnections = false,
  ): Promise<void> => {
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
    if (
      closeActiveConnections &&
      typeof native.closeAllConnections === 'function'
    ) {
      native.closeAllConnections();
    }
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

/** Hands back Node's own server with those two members adapted. */
const asServer = (native: HttpServer): Server => {
  adaptListen(native);
  adaptClose(native);
  return native as unknown as Server;
};

export { asServer };
