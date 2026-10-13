import { Server as HttpServer } from 'node:http';

/**
 * Says whether socket.io can be attached to the server a
 * transport answered with.
 *
 * Socket.io attaches by listening to the `request` and
 * `upgrade` events of a Node `http.Server`, and refuses
 * anything else with "Please pass a http.Server instance". Two
 * of this adapter's transports answer with something that is
 * not one: the Bun one serves through `Bun.serve`, whose server
 * carries `on`, `listen`, `close` and `address` but never fires
 * a Node request event, and the fetch one has no server at all.
 * A shape check would pass on the Bun one and then fail
 * obscurely inside socket.io, so the check is made here, where
 * the reason can be named.
 */
function assertAttachable(
  server: unknown,
): asserts server is HttpServer {
  if (server instanceof HttpServer) {
    return;
  }
  throw new Error(
    'HonoIoAdapter needs a Node http.Server for socket.io to attach to, and this transport does not answer with one. Serve through ./node-server, which runs on Node and on Bun.',
  );
}

export { assertAttachable };
