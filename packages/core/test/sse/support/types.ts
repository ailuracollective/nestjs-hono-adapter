const FRAME_TIMEOUT = 3000;

/** One decoded chunk of an event stream, and when it arrived. */
interface Snapshot {
  readonly at: number;
  readonly text: string;
}

/** What one read of a response body answered. */
interface BodyChunk {
  readonly done: boolean;
  readonly value: Uint8Array | undefined;
}

/** The one read a case needs from the body of a response. */
interface BodyReader {
  readonly read: () => Promise<BodyChunk>;
}

/** Everything one drain of a stream carries between its steps. */
interface Drain {
  readonly deadline: number;
  readonly reader: BodyReader;
  readonly snapshots: Snapshot[];
  text: string;
}

/** Decodes streamed bytes into text. */
const decoder = new TextDecoder();

export { FRAME_TIMEOUT, decoder };
export type { BodyChunk, BodyReader, Drain, Snapshot };
