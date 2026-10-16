import coreManifest from '#root/packages/core/package.json' with { type: 'json' };
import multipartManifest from '#root/packages/multipart/package.json' with { type: 'json' };
import socketIoManifest from '#root/packages/socket-io/package.json' with { type: 'json' };
import wsManifest from '#root/packages/ws/package.json' with { type: 'json' };

interface PublishedPackage {
  readonly dir: string;
  readonly manifest: RuntimeManifest;
  readonly name: string;
  readonly exports: Record<string, { readonly default: string }>;
}

interface RuntimeManifest {
  readonly dependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

const PACKAGES: readonly PublishedPackage[] = [
  {
    dir: 'packages/core',
    exports: coreManifest.exports,
    manifest: coreManifest,
    name: coreManifest.name,
  },
  {
    dir: 'packages/multipart',
    exports: multipartManifest.exports,
    manifest: multipartManifest,
    name: multipartManifest.name,
  },
  {
    dir: 'packages/socket-io',
    exports: socketIoManifest.exports,
    manifest: socketIoManifest,
    name: socketIoManifest.name,
  },
  {
    dir: 'packages/ws',
    exports: wsManifest.exports,
    manifest: wsManifest,
    name: wsManifest.name,
  },
];

const CAPABILITIES = PACKAGES.filter((pkg) => pkg.dir !== 'packages/core');

export { CAPABILITIES, PACKAGES };
export type { PublishedPackage, RuntimeManifest };
