import type { Socket } from '#adapter/core/ports/bindings';

function untuned(this: Socket): Socket {
  return this;
}

const tuneableSocket = (socket: Socket): Socket => {
  if (typeof socket.setKeepAlive === 'function') return socket;
  return Object.assign(socket, {
    setKeepAlive: untuned,
    setNoDelay: untuned,
    setTimeout: untuned,
  });
};

const completedByAdapter = (socket: Socket): boolean => socket.setKeepAlive === untuned;

const reportDisconnect = (socket: Socket): void => {
  if (!completedByAdapter(socket)) {
    return;
  }
  socket.emit('close');
};

export { reportDisconnect, tuneableSocket };
