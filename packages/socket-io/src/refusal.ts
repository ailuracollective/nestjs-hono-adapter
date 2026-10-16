const LISTEN = 'listen';

const CONNECTIONS = 'getConnections';

/**
 * A Node `http.Server` is recognised structurally, because a bridge names no Node builtin: the
 * peer's own path attaches socket.io to exactly that, as it stands.
 */
const isNodeServer = (server: unknown): boolean =>
  typeof server === 'object' &&
  server !== null &&
  typeof Reflect.get(server, LISTEN) === 'function' &&
  typeof Reflect.get(server, CONNECTIONS) === 'function';

const assertAttachable = (server: unknown): void => {
  if (isNodeServer(server)) return;
  throw new Error(
    'Socket.IO needs a Node http.Server to attach to, and this transport does not answer with ' +
      'one. Serve through ./node-server, which runs on Node and on Bun, or install ' +
      '@socket.io/bun-engine to bind to the Bun transport.',
  );
};

export { assertAttachable };
