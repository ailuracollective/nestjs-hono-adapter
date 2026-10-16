import type Busboy from 'busboy';
import type { Readable } from 'node:stream';

interface Pending {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

const pending = (): Pending => {
  let settle: (() => void) | undefined = undefined;
  let refuse: ((reason: unknown) => void) | undefined = undefined;
  const promise = new Promise<void>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    promise,
    reject: (reason) => refuse?.(reason),
    resolve: () => settle?.(),
  };
};

const drainBody = (source: Readable, busboy: ReturnType<typeof Busboy>): Promise<void> => {
  source.unpipe(busboy);
  if (source.readableEnded || source.destroyed) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = (): void => {
      resolve();
    };
    source.once('end', done);
    source.once('close', done);
    source.once('error', done);
    source.resume();
  });
};

export { drainBody, pending };
