import type { StaticAssetsOptions } from './types.ts';

/** The error for an option the Hono handler cannot honour. */
const unsupported = (name: string): TypeError =>
  new TypeError(
    'The Hono adapter cannot honour the static asset ' +
      `option ${name}.`,
  );

/** Refuses the options that hook into another server. */
const assertNoHooks = (options: StaticAssetsOptions): void => {
  if (options.setHeaders !== undefined) {
    throw unsupported('setHeaders');
  }

  if (options.extensions !== undefined) {
    throw unsupported('extensions');
  }

  if (options.etag === false) {
    throw unsupported('etag: false');
  }
};

/** Refuses the options that ask for another serving mode. */
const assertNoOtherModes = (
  options: StaticAssetsOptions,
): void => {
  if (options.fallthrough === false) {
    throw unsupported('fallthrough: false');
  }

  if (options.dotfiles !== undefined) {
    throw unsupported('dotfiles');
  }

  if (options.index === false) {
    throw unsupported('index: false');
  }

  if (
    options.immutable === true &&
    options.maxAge === undefined
  ) {
    throw new TypeError(
      'The Hono adapter writes immutability with a maximum ' +
        'age, so maxAge has to be named with it.',
    );
  }
};

/** Refuses a call that named nothing to serve. */
const assertDirectories = (
  directories: readonly string[],
): void => {
  if (directories.length === 0) {
    throw new TypeError(
      'useStaticAssets() named no directory: name them first, ' +
        'as Express does, or set root, as Fastify does.',
    );
  }
};

export {
  assertDirectories,
  assertNoHooks,
  assertNoOtherModes,
  unsupported,
};
