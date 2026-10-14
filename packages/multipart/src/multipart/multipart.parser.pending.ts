import type Busboy from 'busboy';
import type { Readable } from 'node:stream';

/** A promise and the two ways to settle it. */
interface Pending {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

/** One promise, settled from outside. */
const pending = (): Pending => {
  let settle: (() => void) | undefined = undefined;
  let refuse: ((reason: unknown) => void) | undefined =
    undefined;
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

/** Reads and discards whatever is left of the body. */
const drainBody = (
  source: Readable,
  busboy: ReturnType<typeof Busboy>,
): Promise<void> => {
  source.unpipe(busboy);
  if (source.readableEnded || source.destroyed) {
    return Promise.resolve();
  }
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
