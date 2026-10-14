const FRAME_TIMEOUT = 3000;

interface Snapshot {
  readonly at: number;
  readonly text: string;
}

interface BodyChunk {
  readonly done: boolean;
  readonly value: Uint8Array | undefined;
}

interface BodyReader {
  readonly read: () => Promise<BodyChunk>;
}

interface Drain {
  readonly deadline: number;
  readonly reader: BodyReader;
  readonly snapshots: Snapshot[];
  text: string;
}

const decoder = new TextDecoder();

export { FRAME_TIMEOUT, decoder };
export type { BodyChunk, BodyReader, Drain, Snapshot };
