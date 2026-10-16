const KIB = 1024;

const BYTES_LIMIT = 512;

const CHUNK = 1024;

const CHUNKS = 1024;

const LOOKAHEAD_CHUNKS = 8;

const chunkedBody = (): {
  body: ReadableStream<Uint8Array>;
  pulled: () => number;
  total: number;
} => {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (pulled >= CHUNKS) {
        controller.close();
        return;
      }
      pulled += 1;
      controller.enqueue(new Uint8Array(CHUNK));
    },
  });
  return {
    body,
    pulled: () => pulled * CHUNK,
    total: CHUNKS * CHUNK,
  };
};

export { BYTES_LIMIT, CHUNK, CHUNKS, KIB, LOOKAHEAD_CHUNKS, chunkedBody };
