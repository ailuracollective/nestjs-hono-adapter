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

/** How the registry is read: the version it tags as latest, and whether the read answered. */
type Registry = (name: string) => { readonly out: string; readonly code: number };

/** The environment the workflow runs the script in. */
type Environment = Record<string, string | undefined>;

/**
 * The sources the detection reads: the registry for the last available release, the manifest the
 * repository declares and the lockfile it holds. The readers are injected, so the suite answers
 * with sources of its own: the compatibility matrix moves the manifest and the lockfile to another
 * Nest line, and sources of their own keep the answer the same on every line.
 */
interface Sources {
  /** How the registry is read: the version it tags as latest, and whether the read answered. */
  readonly registry: Registry;
  /** The manifest text: the range each watched package is held in. */
  readonly manifest: () => string | Promise<string>;
  /** The lockfile text: the version each package is resolved at. */
  readonly lockfile: () => string | Promise<string>;
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
 * The registry, read through the package manager: the version it tags as latest, which is the one
 * an install takes. A prerelease carries another tag, so it is never one.
 */
const npmRegistry: Registry = (name) => {
  const result = Bun.spawnSync(['bun', 'pm', 'view', name, 'version'], { env: process.env });
  return { out: result.stdout.toString().trim(), code: result.exitCode };
};

/** The sources the repository offers: the registry, the manifest at the root and its lockfile. */
const npm: Sources = {
  registry: npmRegistry,
  manifest: () => Bun.file('package.json').text(),
  lockfile: () => Bun.file('bun.lock').text(),
};

/**
 * The last available release of a package: the version the registry tags as latest, which is the
 * one an install takes.
 */
const lastAvailable = (name: string, registry: Registry = npmRegistry): string => {
  const { out, code } = registry(name);
  if (code !== 0) {
    throw new Error(`The registry answered no version for ${name}.`);
  }
  return out;
};

/**
 * The lockfile says which version the tree holds: the package.json declares a range, so it no
 * longer names one.
 */
const resolved = async (name: string, sources: Sources = npm): Promise<string> => {
  const lock = Bun.JSONC.parse(await sources.lockfile()) as {
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

const detect = async (
  watched: Watched,
  range: string,
  sources: Sources = npm,
): Promise<Detection> => {
  const from = await resolved(watched.name, sources);
  const last = lastAvailable(watched.name, sources.registry);
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
 * The version the canary installs: the last release, unless the declared range does not take it. A
 * release outside the range has to be widened first, so the canary keeps the resolved one; a forced
 * run installs the last release whatever the range says.
 */
const targetOf = (detection: Detection, force: boolean): string =>
  force || detection.accepted ? detection.last : detection.from;

/**
 * The outputs the detection writes, in the form the workflow reads them. Nothing in the types ties
 * these names to the workflow's: a name that drifts is a watch that never runs.
 */
const outputsOf = (detections: Detection[], force = false): string[] => {
  const outputs = [`detected=${isDetected(detections)}`];
  for (const detection of detections) {
    const watched = WATCHED.find((entry) => entry.name === detection.name);
    if (watched === undefined) {
      continue;
    }
    outputs.push(
      `${watched.key}_from=${detection.from}`,
      `${watched.key}_to=${targetOf(detection, force)}`,
    );
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

const main = async (sources: Sources = npm, environment: Environment = Bun.env): Promise<void> => {
  const root = JSON.parse(await sources.manifest()) as {
    devDependencies?: Record<string, string>;
  };
  const devDependencies = root.devDependencies ?? {};

  const detections: Detection[] = [];
  for (const watched of WATCHED) {
    const range = devDependencies[watched.name];
    if (range === undefined) {
      throw new Error(`${watched.name} is not in the root devDependencies.`);
    }
    detections.push(await detect(watched, range, sources));
  }

  // A forced run installs the last release whatever the declared range takes.
  const force = environment.UPSTREAM_FORCE === 'true';
  await write(environment.GITHUB_OUTPUT, `${outputsOf(detections, force).join('\n')}\n`);
  await write(environment.GITHUB_STEP_SUMMARY, summaryOf(detections));
};

if (import.meta.main) {
  await main();
}

export {
  compare,
  detect,
  isDetected,
  lastAvailable,
  main,
  majorOf,
  outputsOf,
  resolved,
  summaryOf,
  targetOf,
};
export type { Detection, Environment, Registry, Sources, Watched };
