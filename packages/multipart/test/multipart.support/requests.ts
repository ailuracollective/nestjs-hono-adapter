import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

import { abortDirectory, directory } from './constants.ts';

/** Removes the directories the disk cases write. */
const cleanup = async (): Promise<void> => {
  await Promise.all([
    rm(abortDirectory, { force: true, recursive: true }),
    rm(directory, { force: true, recursive: true }),
  ]);
};

/** Answers a promise, or `'hung'` past the deadline. */
const withDeadline = <Value>(
  promise: Promise<Value>,
  deadline: number,
): Promise<Value | 'hung'> =>
  Promise.race([promise, delay(deadline, 'hung' as const)]);

/** Builds a body that opens a file part and then errors. */
const abortingBody = (
  boundary: string,
): ReadableStream<Uint8Array> => {
  const head =
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="abort.txt"\r\n' +
    'Content-Type: text/plain\r\n\r\n';
  return new ReadableStream<Uint8Array>({
    pull(controller): void {
      controller.error(new Error('client aborted'));
    },
    start(controller): void {
      controller.enqueue(
        new TextEncoder().encode(`${head}partial`),
      );
    },
  });
};

/** Reads a value as a record. */
const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return Object.fromEntries(Object.entries(value));
};

export { abortingBody, asRecord, cleanup, withDeadline };
