import path from 'node:path';

const ENTRY = path.resolve(import.meta.dirname, '../../../packages/core/src/index.ts');
const NODE_ENTRY = path.resolve(import.meta.dirname, '../../../packages/core/src/servers/node.ts');
const WS_ENTRY = path.resolve(import.meta.dirname, '../../../packages/ws/src/index.ts');
const MULTIPART_ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/multipart/src/index.ts',
);
const SOCKET_IO_ENTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/socket-io/src/index.ts',
);

export { ENTRY, MULTIPART_ENTRY, NODE_ENTRY, SOCKET_IO_ENTRY, WS_ENTRY };
