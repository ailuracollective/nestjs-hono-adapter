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

function resolveBase(options: IgnoreBuildOptions): string {
  if (options.base !== undefined && options.base.trim() !== '') {
    return options.base.trim();
  }

  const rawPrevious = processRef.env.VERCEL_GIT_PREVIOUS_SHA;
  const previous = (options.previousSha ?? rawPrevious ?? '').trim();
  if (previous !== '') {
    return previous;
  }

  return 'HEAD^';
}

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
    const output = execFileSync(
      'git',
      ['diff', '--name-only', '--no-ext-diff', base, head, '--', ...paths],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ) as string;
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
} {
  const paths: string[] = [];
  let base: string | undefined;
  let head: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      console.log('Usage: vercel-ignore-build [--base <sha>] [--head <sha>] <path>...');
      console.log('Exit code 0 skips the Vercel deployment; 1 or greater allows it.');
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

    if (argument.startsWith('--base=')) {
      base = argument.slice('--base='.length);
      continue;
    }

    if (argument.startsWith('--head=')) {
      head = argument.slice('--head='.length);
      continue;
    }

    // A convenience form for comma-separated paths, while normal shell
    // arguments remain first-class.
    if (argument.startsWith('--paths=')) {
      paths.push(...argument.slice('--paths='.length).split(','));
      continue;
    }

    paths.push(argument);
  }

  return { paths, base, head };
}

function main(): number {
  const { paths, base, head } = parseArgs(processRef.argv.slice(2));
  const rawPrevious = processRef.env.VERCEL_GIT_PREVIOUS_SHA;
  const previousSha = rawPrevious;

  const result = checkPaths({ base, head, paths, previousSha });

  if (result.changed.length > 0) {
    console.log(result.changed.join('\n'));
  }
  console.log(result.reason);

  return result.build ? 1 : 0;
}

const isMain = Reflect.get(import.meta, 'main') === true;
if (isMain) {
  processRef.exit(main());
}

export type { IgnoreBuildOptions, IgnoreBuildResult };

export { resolveBase, checkPaths };
