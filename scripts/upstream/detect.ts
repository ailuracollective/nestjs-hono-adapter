/**
 * The nightly upstream watch: compares the version the lockfile resolved with the last available
 * release of the watched packages.
 *
 * Run from the repository root: `bun scripts/upstream/detect.ts`.
 */

interface Watched {
  key: string;
  name: string;
}

interface Detection {
  name: string;
  range: string;
  from: string;
  last: string;
  isNew: boolean;
  accepted: boolean;
}

const WATCHED: Watched[] = [
  { key: 'hono', name: 'hono' },
  { key: 'nest', name: '@nestjs/core' },
];

const majorOf = (version: string): number => Math.trunc(Number(version.split('.')[0] ?? '0'));

const compare = (left: string, right: string): number => {
  const leftParts = left.split('.').map((part) => Math.trunc(Number(part)) || 0);
  const rightParts = right.split('.').map((part) => Math.trunc(Number(part)) || 0);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

/**
 * The last available release of a package: the version the registry tags as latest, which is the
 * one an install takes. A prerelease carries another tag, so it is never one.
 */
const lastAvailable = (name: string): string => {
  const result = Bun.spawnSync(['bun', 'pm', 'view', name, 'version'], { env: process.env });
  const out = result.stdout.toString().trim();
  if (result.exitCode !== 0) {
    throw new Error(`The registry answered no version for ${name}.`);
  }
  return out;
};

/**
 * The lockfile says which version the tree holds: the package.json declares a range, so it no
 * longer names one.
 */
const resolved = async (name: string): Promise<string> => {
  const lock = Bun.JSONC.parse(await Bun.file('bun.lock').text()) as {
    packages?: Record<string, unknown[]>;
  };
  const packages = lock.packages ?? {};
  const nested = Object.entries(packages).find(([key]) => key.startsWith(`${name}@`));
  const entry = packages[name] ?? (nested === undefined ? undefined : nested[1]);
  const spec = entry === undefined ? undefined : entry[0];
  if (typeof spec !== 'string') {
    throw new TypeError(`The lockfile holds no ${name}.`);
  }
  return spec.slice(spec.lastIndexOf('@') + 1);
};

const detect = async (watched: Watched, range: string): Promise<Detection> => {
  const from = await resolved(watched.name);
  const last = lastAvailable(watched.name);
  return {
    name: watched.name,
    range,
    from,
    last,
    isNew: compare(last, from) > 0,
    accepted: Bun.semver.satisfies(last, range),
  };
};

/** Whether a new release the declared range takes is among the detections. */
const isDetected = (detections: Detection[]): boolean =>
  detections.some((detection) => detection.isNew && detection.accepted);

/**
 * The outputs the detection writes, in the form the workflow reads them. Nothing in the types ties
 * these names to the workflow's: a name that drifts is a watch that never runs.
 */
const outputsOf = (detections: Detection[]): string[] => {
  const outputs = [`detected=${isDetected(detections)}`];
  for (const detection of detections) {
    const watched = WATCHED.find((entry) => entry.name === detection.name);
    if (watched === undefined) {
      continue;
    }
    outputs.push(`${watched.key}_from=${detection.from}`, `${watched.key}_to=${detection.last}`);
  }
  return outputs;
};

const summaryOf = (detections: Detection[]): string => {
  const rows = detections.map(
    (detection) =>
      `| \`${detection.name}\` | \`${detection.range}\` | ${detection.from} | ${detection.last} | ${
        detection.isNew && detection.accepted ? 'yes' : 'no'
      } |`,
  );
  const outside = detections
    .filter((detection) => detection.isNew && !detection.accepted)
    .map(
      (detection) =>
        `- \`${detection.name}\` ${detection.last} is the last available version; the repository declares \`${detection.range}\`.`,
    );
  return [
    '## Upstream releases',
    '',
    '| Package | Declared | Resolved | Last available | New release |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    isDetected(detections)
      ? 'A new release is available: the suite runs against it.'
      : 'No new release is available: nothing to run.',
    ...(outside.length > 0 ? ['', '### Outside the declared range', '', ...outside] : []),
    '',
  ].join('\n');
};

const write = async (file: string | undefined, content: string): Promise<void> => {
  if (file === undefined || file === '') {
    throw new Error('The workflow did not set the file to write.');
  }
  await Bun.write(file, content);
};

const main = async (): Promise<void> => {
  const root = (await Bun.file('package.json').json()) as {
    devDependencies?: Record<string, string>;
  };
  const devDependencies = root.devDependencies ?? {};

  const detections: Detection[] = [];
  for (const watched of WATCHED) {
    const range = devDependencies[watched.name];
    if (range === undefined) {
      throw new Error(`${watched.name} is not in the root devDependencies.`);
    }
    detections.push(await detect(watched, range));
  }

  await write(Bun.env.GITHUB_OUTPUT, `${outputsOf(detections).join('\n')}\n`);
  await write(Bun.env.GITHUB_STEP_SUMMARY, summaryOf(detections));
};

if (import.meta.main) {
  await main();
}

export { compare, detect, isDetected, lastAvailable, majorOf, outputsOf, resolved, summaryOf };
export type { Detection, Watched };
