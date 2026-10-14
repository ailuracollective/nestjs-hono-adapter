/** The bytes in one kibibyte. */
const KIB = 1024;

/** A limit written as a plain number of bytes. */
const BYTES_LIMIT = 512;

/** The size of one piece a streaming body hands over. */
const CHUNK = 1024;

/** How many pieces a streaming body holds. */
const CHUNKS = 1024;

/** The pieces the stream plumbing may read ahead. */
const LOOKAHEAD_CHUNKS = 8;

/** Builds a body that arrives in pieces and counts them. */
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

export {
  BYTES_LIMIT,
  CHUNK,
  CHUNKS,
  KIB,
  LOOKAHEAD_CHUNKS,
  chunkedBody,
};
