import { Session } from 'node:inspector/promises';

const SAMPLING_INTERVAL = 32_768;
const session = new Session();
session.connect();

/** Includes collected objects: an exit-time heap profile alone only shows survivors. */
const main = async (): Promise<void> => {
  await session.post('HeapProfiler.startSampling', {
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
    samplingInterval: SAMPLING_INTERVAL,
  });
  try {
    await import('./profile.ts');
    const { profile } = await session.post('HeapProfiler.stopSampling');
    process.stdout.write(`${JSON.stringify(profile)}\n`);
  } finally {
    session.disconnect();
  }
};

// oxlint-disable-next-line node/no-top-level-await -- Node-only allocation profiling entrypoint.
await main();
