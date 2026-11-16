import { VERSION } from '@dudousxd/nestjs-inertia';

const SUPPORTED_MAJOR = '3.';

const supportsInertia = (version: string): boolean => version.startsWith(SUPPORTED_MAJOR);

/**
 * The bridge patches internals of the 3.x line. Refuse another major instead of failing inside a
 * request after the module has already been fitted.
 */
const assertInertiaVersion = (version: string = VERSION): void => {
  if (supportsInertia(version)) return;
  throw new Error(
    `@ailura/nestjs-platform-hono-inertia supports @dudousxd/nestjs-inertia 3.x; found ${version}.`,
  );
};

export { assertInertiaVersion, supportsInertia };
