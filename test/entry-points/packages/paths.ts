import path from 'node:path';

/** The HTTP entry point's source. */
const ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/core/src/index.ts',
);
/** The Node transport entry point's source. */
const NODE_ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/core/src/servers/node.ts',
);
/** The WebSocket entry point's source. */
const WS_ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/ws/src/index.ts',
);
/** The multipart entry point's source. */
const MULTIPART_ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/multipart/src/index.ts',
);
/** The socket.io entry point's source. */
const SOCKET_IO_ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/socket-io/src/index.ts',
);

export {
  ENTRY,
  MULTIPART_ENTRY,
  NODE_ENTRY,
  SOCKET_IO_ENTRY,
  WS_ENTRY,
};
