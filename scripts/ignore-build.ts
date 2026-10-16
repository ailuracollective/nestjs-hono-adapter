import { execFileSync } from 'node:child_process';

const processRef = process as unknown as {
  exit: (code: number) => never;
  cwd: () => string;
  env: Readonly<Record<string, string | undefined>>;
  argv: readonly string[];
};

interface IgnoreBuildOptions {
  paths: string[];
  base?: string | undefined;
  head?: string | undefined;
  previousSha?: string | undefined;
  cwd?: string;
}

interface IgnoreBuildResult {
  build: boolean;
  changed: string[];
  base: string;
  head: string;
  reason: string;
}

const FETCH_EXAMPLE_PATH = 'packages/examples/google/fetch/';
const NODE_EXAMPLE_PATH = 'packages/examples/google/node/';
const CORE_SOURCE_PATH = 'packages/core/src/';
const CORE_RELEVANT_FILES = new Set([
  'packages/core/package.json',
  'packages/core/tsconfig.json',
  'packages/core/tsconfig.build.json',
]);
const ROOT_RELEVANT_FILES = new Set(['package.json', 'bun.lock', 'tsconfig.json', 'bunfig.toml']);
const GOOGLE_BUILD_NAMES = ['fetch', 'node'] as const;
type GoogleBuildName = (typeof GOOGLE_BUILD_NAMES)[number];

function resolveBase(options: IgnoreBuildOptions): string {
  if (options.base !== undefined && options.base.trim() !== '') {
    return options.base.trim();
  }

  const rawPrevious =
    processRef.env.GOOGLE_GIT_PREVIOUS_SHA ?? processRef.env.VERCEL_GIT_PREVIOUS_SHA;
  const previous = (options.previousSha ?? rawPrevious ?? '').trim();
  if (previous !== '') {
    return previous;
  }

  return 'HEAD^';
}

function isRelevantCoreChange(filePath: string): boolean {
  if (filePath.startsWith(CORE_SOURCE_PATH)) {
    return true;
  }
  return CORE_RELEVANT_FILES.has(filePath);
}

function getAffectedGoogleBuilds(changedFiles: readonly string[]): GoogleBuildName[] {
  const affected = new Set<GoogleBuildName>();

  if (changedFiles.length === 0) {
    return [...GOOGLE_BUILD_NAMES];
  }

  let unknownPath = false;

  for (const rawFile of changedFiles) {
    const file = rawFile.trim().replace(/^\.\//, '');
    if (file === '') {
      continue;
    }

    if (file.startsWith(FETCH_EXAMPLE_PATH) || file.startsWith(NODE_EXAMPLE_PATH)) {
      if (file.startsWith(FETCH_EXAMPLE_PATH)) {
        affected.add('fetch');
      }
      if (file.startsWith(NODE_EXAMPLE_PATH)) {
        affected.add('node');
      }
      continue;
    }

    if (file.startsWith('packages/core/')) {
      if (isRelevantCoreChange(file)) {
        affected.add('fetch');
        affected.add('node');
      }
      continue;
    }

    if (file.startsWith('packages/')) {
      continue;
    }

    if (ROOT_RELEVANT_FILES.has(file)) {
      affected.add('fetch');
      affected.add('node');
      continue;
    }

    if (
      file.startsWith('docs/') ||
      file.startsWith('test/') ||
      file.startsWith('scripts/') ||
      file.startsWith('.github/')
    ) {
      continue;
    }

    unknownPath = true;
  }

  if (unknownPath) {
    return [...GOOGLE_BUILD_NAMES];
  }

  return [...affected].toSorted();
}

function googleBuildsAffected(changedFiles: readonly string[]): {
  fetch: boolean;
  node: boolean;
} {
  const affected = new Set(getAffectedGoogleBuilds(changedFiles));
  return {
    fetch: affected.has('fetch'),
    node: affected.has('node'),
  };
}

const getAffectedBuilds = getAffectedGoogleBuilds;
const getAffectedDeployments = getAffectedGoogleBuilds;
const getAffectedGoogleDeployments = getAffectedGoogleBuilds;
const getAffectedWorkers = getAffectedGoogleBuilds;

function checkPaths(options: IgnoreBuildOptions): IgnoreBuildResult {
  const cwd = options.cwd ?? processRef.cwd();
  const base = resolveBase(options);
  const head = (options.head ?? 'HEAD').trim();
  const paths = options.paths.filter((path) => path.trim() !== '');

  if (paths.length === 0) {
    return {
      build: true,
      changed: [],
      base,
      head,
      reason: 'no paths were provided, so the build is allowed for safety',
    };
  }

  try {
    const output = execFileSync('git', ['diff', '--name-only', '--no-ext-diff', base, head], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as string;
    const changed = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '');

    if (changed.length > 0) {
      return {
        build: true,
        changed,
        base,
        head,
        reason: `changed paths detected: ${changed.join(', ')}`,
      };
    }

    return {
      build: false,
      changed: [],
      base,
      head,
      reason: 'none of the watched paths changed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      build: true,
      changed: [],
      base,
      head,
      reason: `git diff could not be evaluated safely, so the build proceeds: ${message}`,
    };
  }
}

function parseArgs(argv: string[]): {
  paths: string[];
  base?: string | undefined;
  head?: string | undefined;
  target?: string | undefined;
  server?: string | undefined;
} {
  const paths: string[] = [];
  let base: string | undefined;
  let head: string | undefined;
  let target: string | undefined;
  let server: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      console.log(
        'Usage: google-ignore-build [--target fetch|node] [--base <sha>] [--head <sha>] <path>...',
      );
      console.log('Exit code 0 skips the Google Cloud deployment; 1 or greater allows it.');
      processRef.exit(0);
    }

    if (argument === '--base' || argument === '-b') {
      base = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument === '--head') {
      head = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument === '--target' || argument === '-t') {
      target = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument === '--server' || argument === '-s') {
      server = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith('--base=')) {
      base = argument.slice('--base='.length);
      continue;
    }

    if (argument.startsWith('--head=')) {
      head = argument.slice('--head='.length);
      continue;
    }

    if (argument.startsWith('--target=')) {
      target = argument.slice('--target='.length);
      continue;
    }

    if (argument.startsWith('--server=')) {
      server = argument.slice('--server='.length);
      continue;
    }

    if (argument.startsWith('--paths=')) {
      paths.push(...argument.slice('--paths='.length).split(','));
      continue;
    }

    paths.push(argument);
  }

  return { base, head, paths, server, target };
}

function googleTargetExitCode(
  result: IgnoreBuildResult,
  target: GoogleBuildName,
  paths: string[],
): number {
  if (result.changed.length === 0) {
    if (!result.build) {
      console.log(result.reason);
      return 0;
    }
    const affected = new Set(
      getAffectedGoogleBuilds(paths.length > 0 ? paths : [...GOOGLE_BUILD_NAMES]),
    );
    console.log(result.reason);
    return affected.has(target) ? 1 : 0;
  }

  const affected = new Set(getAffectedGoogleBuilds(result.changed));
  console.log(result.reason);
  return affected.has(target) ? 1 : 0;
}

function printGoogleAffected(result: IgnoreBuildResult, paths: string[]): void {
  if (!result.build) {
    console.log('');
    console.log(result.reason);
    return;
  }

  let changedFiles: string[] = [];
  if (result.changed.length > 0) {
    changedFiles = result.changed;
  } else if (paths.length > 0) {
    changedFiles = paths;
  }

  const affectedFiles = changedFiles.length > 0 ? changedFiles : [...GOOGLE_BUILD_NAMES];
  console.log(getAffectedGoogleBuilds(affectedFiles).join(' '));
  console.log(result.reason);
}

function main(): number {
  const { paths, base, head, target, server: parsedServer } = parseArgs(processRef.argv.slice(2));
  const rawPrevious =
    processRef.env.GOOGLE_GIT_PREVIOUS_SHA ?? processRef.env.VERCEL_GIT_PREVIOUS_SHA;
  const previousSha = rawPrevious;
  const server = (
    parsedServer ??
    processRef.env.IGNORE_BUILD_SERVER ??
    processRef.env.BUILD_SERVER ??
    processRef.env.SERVER ??
    'vercel'
  )
    .trim()
    .toLowerCase();

  const result = checkPaths({ base, head, paths, previousSha });
  if (result.changed.length > 0) {
    console.log(result.changed.join('\n'));
  }

  if (server === 'google') {
    if (target === 'fetch' || target === 'node') {
      return googleTargetExitCode(result, target as GoogleBuildName, paths);
    }

    printGoogleAffected(result, paths);
    return 0;
  }

  console.log(result.reason);
  return result.build ? 1 : 0;
}

const isMain = Reflect.get(import.meta, 'main') === true;
if (isMain) {
  processRef.exit(main());
}

export type { IgnoreBuildOptions, IgnoreBuildResult };
export {
  checkPaths,
  resolveBase,
  isRelevantCoreChange,
  getAffectedGoogleBuilds,
  googleBuildsAffected,
  getAffectedBuilds,
  getAffectedDeployments,
  getAffectedGoogleDeployments,
  getAffectedWorkers,
};
