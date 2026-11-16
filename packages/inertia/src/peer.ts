import { VERSION } from '@dudousxd/nestjs-inertia';

const SUPPORTED_MAJOR = '3.';

const assertSupported = (version: string): void => {
  if (!version.startsWith(SUPPORTED_MAJOR)) {
    throw new Error(
      `@ailura/nestjs-platform-hono-inertia supports @dudousxd/nestjs-inertia 3.x; found ${version}.`,
    );
  }
};

const guardPeer = (): void => {
  assertSupported(VERSION);
};

export { assertSupported, guardPeer };
