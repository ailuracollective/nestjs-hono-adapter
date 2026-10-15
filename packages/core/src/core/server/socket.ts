import type { Socket } from '#adapter/core/ports/bindings';

function untuned(this: Socket): Socket {
  return this;
}

const completed = new WeakSet<Socket>();

const tuneableSocket = (socket: Socket): Socket => {
  if (typeof socket.setKeepAlive === 'function') return socket;
  completed.add(socket);
  return Object.assign(socket, {
    setKeepAlive: untuned,
    setNoDelay: untuned,
    setTimeout: untuned,
  });
};

const completedByAdapter = (socket: Socket): boolean => completed.has(socket);

const reportDisconnect = (socket: Socket): void => {
  if (!completedByAdapter(socket)) {
    return;
  }
  socket.emit('close');
};

export { reportDisconnect, tuneableSocket };
