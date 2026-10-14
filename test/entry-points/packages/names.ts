/** The parser the upload island alone may reach. */
const UPLOAD_PARSER = 'busboy';

/** The packages only a deployment that serves websockets needs. */
const ISLAND_PEERS = ['@hono/node-ws', '@nestjs/websockets'];

/** The protocol the socket.io island alone may reach. */
const SOCKET_IO_PEER = 'socket.io';

/** The module the adapter's default transport alone names. */
const DEFAULT_SERVER = 'hono/bun';

/**
 * The server package only the Node transport reaches at run
 * time.
 */
const NODE_SERVER = '@hono/node-server';

/** The name the adapter core publishes under. */
const CORE_NAME = '@ailura/nestjs-hono-adapter';

/** The prefix the three capability packages share. */
const PLATFORM_PREFIX = '@ailura/nestjs-platform-hono-';

/** The three capability packages, under their published names. */
const PLATFORM_NAMES = [
  `${PLATFORM_PREFIX}multipart`,
  `${PLATFORM_PREFIX}socket-io`,
  `${PLATFORM_PREFIX}ws`,
];

/** The modules a source file names in its import statements. */
const SPECIFIER = /from\s+'(?<module>[^']+)'/gu;

/** The modules a source file names in dynamic imports. */
const DYNAMIC_SPECIFIER =
  /import\(\s*'(?<module>[^']+)'\s*\)/gu;

/** A type-only import or export statement, up to its semicolon. */
const TYPE_STATEMENT =
  /\b(?:import|export)\s+type\b[\s\S]*?;/gu;

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
