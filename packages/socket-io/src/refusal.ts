import { Server as HttpServer } from 'node:http';

/** Refuses a server socket.io cannot attach to. */
const assertAttachable: (
  server: unknown,
) => asserts server is HttpServer = (server) => {
  if (server instanceof HttpServer) {
    return;
  }
  throw new Error(
    'HonoIoAdapter needs a Node http.Server for socket.io to attach to, and this transport does not answer with one. Serve through ./node-server, which runs on Node and on Bun.',
  );
};

export { assertAttachable };
