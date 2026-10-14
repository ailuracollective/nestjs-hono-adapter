import { setTimeout as delay } from 'node:timers/promises';

import { decoder } from './types.ts';
import type { BodyChunk, BodyReader, Drain, Snapshot } from './types.ts';

const failAfter = async (ms: number): Promise<never> => {
  await delay(ms, undefined, { ref: false });
  throw new Error('The event stream did not answer in time.');
};

const nextChunk = (reader: BodyReader, deadline: number): Promise<BodyChunk> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('The event stream did not answer in time.');
  return Promise.race([reader.read(), failAfter(remaining)]);
};

const drain = async (state: Drain): Promise<readonly Snapshot[]> => {
  const chunk = await nextChunk(state.reader, state.deadline);
  if (chunk.done) return state.snapshots;
  const { value } = chunk;
  if (value !== undefined) {
    state.text += decoder.decode(value);
    state.snapshots.push({ at: Date.now(), text: state.text });
  }
  return drain(state);
};

const collect = (body: ReadableStream<Uint8Array>, ms: number): Promise<readonly Snapshot[]> =>
  drain({
    deadline: Date.now() + ms,
    reader: body.getReader(),
    snapshots: [],
    text: '',
  });

const framesOf = (snapshots: readonly Snapshot[]): string => {
  let text = '';
  for (const { text: frame } of snapshots) {
    text = frame;
  }
  return text;
};

export { collect, drain, failAfter, framesOf, nextChunk };
