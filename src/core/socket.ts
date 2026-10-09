/**
 * The socket Nest reads when it opens an event stream: the
 * calls it tunes it with, and the close it watches for.
 *
 * `SseStream` calls `setKeepAlive`, `setNoDelay` and
 * `setTimeout(0)` on `req.socket`, and watches that socket for
 * `close`. A runtime can carry a request without carrying the
 * TCP socket behind it — Cloudflare Workers through
 * `cloudflare:node` reports a socket with `on`, `once` and
 * `remoteAddress` and none of the three calls — so opening a
 * stream there fails with a `TypeError` before a single frame
 * is written. Those calls are filled in with what a socket that
 * cannot be tuned has to say, which is nothing; everything else
 * is left alone, and a socket that can be tuned is handed back
 * untouched.
 */

import type { IncomingMessage } from 'node:http';

/**
 * The socket a request carries, named through the import the
 * source already has: `node:net` is not one of the builtins the
 * platform freeze lets the source name.
 */
type Socket = IncomingMessage['socket'];

/**
 * What a tuning call answers with; it answers with itself, so a
 * caller can chain them.
 */
function untuned(this: Socket): Socket {
  return this;
}

/**
 * The socket a request hands over, with the calls Nest makes on
 * it answering where the runtime has none.
 */
function tuneableSocket(socket: Socket): Socket {
  if (typeof socket.setKeepAlive === 'function') {
    return socket;
  }
  return Object.assign(socket, {
    setKeepAlive: untuned,
    setNoDelay: untuned,
    setTimeout: untuned,
  });
}

/**
 * Whether the adapter completed this socket itself. One of the
 * calls answering with the adapter's own function is what tells
 * it from one the runtime provides, and a runtime that provides
 * the socket provides everything else a Node socket carries.
 */
function completedByAdapter(socket: Socket): boolean {
  return socket.setKeepAlive === untuned;
}

/**
 * Says the client is gone, on the object a stream's reader
 * watches. A socket the runtime left incomplete never reports a
 * close of its own, so the disconnect is said here, on the
 * socket Nest is listening on. A socket the runtime provides is
 * left alone: it reports its own close, and a second one would
 * lie about a connection that is still open.
 */
function reportDisconnect(socket: Socket): void {
  if (!completedByAdapter(socket)) {
    return;
  }
  socket.emit('close');
}

export { reportDisconnect, tuneableSocket };
