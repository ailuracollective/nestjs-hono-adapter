const UPLOAD_PARSER = 'busboy';

const ISLAND_PEERS = ['@hono/node-ws', '@nestjs/websockets'];

const SOCKET_IO_PEER = 'socket.io';

const DEFAULT_SERVER = 'hono/bun';

const NODE_SERVER = '@hono/node-server';

const CORE_NAME = '@ailura/nestjs-hono-adapter';

const PLATFORM_PREFIX = '@ailura/nestjs-platform-hono-';

const PLATFORM_NAMES = [
  `${PLATFORM_PREFIX}multipart`,
  `${PLATFORM_PREFIX}socket-io`,
  `${PLATFORM_PREFIX}ws`,
];

const SPECIFIER = /from\s+'(?<module>[^']+)'/gu;

const DYNAMIC_SPECIFIER = /import\(\s*'(?<module>[^']+)'\s*\)/gu;

const TYPE_STATEMENT = /\b(?:import|export)\s+type\b[\s\S]*?;/gu;

export {
  CORE_NAME,
  DEFAULT_SERVER,
  DYNAMIC_SPECIFIER,
  ISLAND_PEERS,
  NODE_SERVER,
  PLATFORM_NAMES,
  PLATFORM_PREFIX,
  SOCKET_IO_PEER,
  SPECIFIER,
  TYPE_STATEMENT,
  UPLOAD_PARSER,
};
