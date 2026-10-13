import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

/** The last argument, where the shell puts the package name. */
const LAST = -1;

/**
 * The core still serves the subpath of a capability that now
 * lives in its own package, so the package build is copied
 * where `exports` looks for it. It is a copy and not a source
 * re-export because the package takes the core ports as types:
 * a re-export would make the two builds wait for each other.
 */
async function copyEntry(): Promise<void> {
  const name = process.argv.at(LAST);

  if (name === undefined || name.startsWith('-')) {
    throw new Error(
      'usage: bun run scripts/copy-compat-entry.ts <package>',
    );
  }

  const root = path.resolve(import.meta.dir, '..');
  const from = path.join(root, 'packages', name, 'dist');
  const to = path.join(root, 'dist', name);
  const files = await readdir(from);
  await mkdir(to, { recursive: true });
  await Promise.all(
    files.map((file) =>
      cp(path.join(from, file), path.join(to, file)),
    ),
  );
}

void copyEntry();
