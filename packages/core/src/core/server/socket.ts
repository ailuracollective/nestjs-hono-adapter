import type { Socket } from '#adapter/core/ports/bindings';

/** What a tuning call answers with. */
function untuned(this: Socket): Socket {
  return this;
}

/** The socket a request hands over, with Nest's calls filled in. */
const tuneableSocket = (socket: Socket): Socket => {
  if (typeof socket.setKeepAlive === 'function') {
    return socket;
  }
  return Object.assign(socket, {
    setKeepAlive: untuned,
    setNoDelay: untuned,
    setTimeout: untuned,
  });
};

/** Whether the adapter completed this socket itself. */
const completedByAdapter = (socket: Socket): boolean =>
  socket.setKeepAlive === untuned;

/** Says the client is gone to a stream's reader. */
const reportDisconnect = (socket: Socket): void => {
  if (!completedByAdapter(socket)) {
    return;
  }
  socket.emit('close');
};

export { reportDisconnect, tuneableSocket };
