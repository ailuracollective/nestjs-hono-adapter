/**
 * The socket Nest reads when it opens an event stream: the
 * calls it tunes it with, and the close it watches for.
 *
 * `SseStream`, Nest’s own, calls `setKeepAlive(true)`,
 * `setNoDelay(true)` and `setTimeout(0)` on `req.socket` for
 * every request that is not HTTP/2. The calls are an
 * optimisation: they keep a stream that goes quiet for a while
 * from being dropped, and they stop each frame waiting on the
 * one after it for Nagle.
 *
 * A runtime can carry a request without carrying the TCP socket
 * behind it. Cloudflare Workers does: through `cloudflare:node`
 * a request reports a socket with `on`, `once` and
 * `remoteAddress`, reports HTTP/1.1, and has none of the three
 * calls, so opening a stream fails with `TypeError:
 * req.socket.setKeepAlive is not a function` before a single
 * frame is written.
 *
 * They are filled in with what a socket that cannot be tuned
 * has to say, which is nothing. Everything else about the
 * socket is left alone, and one that can be tuned is handed
 * back untouched — which is every request served on Node.
 */

import type { IncomingMessage } from 'node:http';

/**
 * The socket a request carries, named through the import the
 * source already has: `node:net` is not one of the builtins the
 * platform freeze lets the source name.
 */
type Socket = IncomingMessage['socket'];

/**
 * What a tuning call is answered with on a socket that has
 * nothing to tune. It answers with itself, as the real calls
 * do, so a caller that chains them still can.
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
 * Whether the adapter completed this socket itself.
 *
 * One of the calls answering with the adapter’s own function is
 * what tells a completed socket from one the runtime provides,
 * and a runtime that provides the socket provides everything
 * else a Node socket carries with it.
 */
function completedByAdapter(socket: Socket): boolean {
  return socket.setKeepAlive === untuned;
}

/**
 * Says the client is gone, on the object a stream’s reader
 * watches for it.
 *
 * Nest opens an event stream by watching the request’s socket
 * for `close`, which is how a client walking away reaches the
 * handler on a runtime that has a socket. A socket the runtime
 * left incomplete never reports one, so the disconnect arrives
 * from wherever the runtime does say it and is said here, on
 * the socket itself, where Nest is listening. A socket the
 * runtime provides is left alone: it reports its own close, and
 * a second one would be a lie about a connection that is still
 * open.
 */
function reportDisconnect(socket: Socket): void {
  if (!completedByAdapter(socket)) {
    return;
  }
  socket.emit('close');
}

export { reportDisconnect, tuneableSocket };
