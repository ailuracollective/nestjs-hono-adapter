/** How long a cached answer is kept, in milliseconds. */
const TTL = 60_000;

/** The shape the cache holds answers in. */
interface Cache {
  readonly del: (key: string) => Promise<void>;
  readonly get: <Held>(
    key: string,
  ) => Promise<Held | undefined>;
  readonly set: (
    key: string,
    value: unknown,
    ttl?: number,
  ) => Promise<unknown>;
}

export { TTL };
export type { Cache };
