import coreManifest from '#root/packages/core/package.json' with { type: 'json' };
import multipartManifest from '#root/packages/multipart/package.json' with { type: 'json' };
import socketIoManifest from '#root/packages/socket-io/package.json' with { type: 'json' };
import wsManifest from '#root/packages/ws/package.json' with { type: 'json' };

/** One published package, and the directory its source lives in. */
interface PublishedPackage {
  /** The package directory, relative to the repository root. */
  readonly dir: string;
  /** The half of its manifest a consumer resolves. */
  readonly manifest: RuntimeManifest;
  /** The name it publishes under. */
  readonly name: string;
  /** Its published entry points. */
  readonly exports: Record<
    string,
    { readonly default: string }
  >;
}

/** The half of a manifest a consumer resolves. */
interface RuntimeManifest {
  /** What a deployment installs with the package. */
  readonly dependencies?: Record<string, string>;
  /** What a deployment may install with the package. */
  readonly optionalDependencies?: Record<string, string>;
  /** What the deployment must supply itself. */
  readonly peerDependencies?: Record<string, string>;
}

/** Everything the repository publishes. */
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

/** The three packages that left the adapter. */
const CAPABILITIES = PACKAGES.filter(
  (pkg) => pkg.dir !== 'packages/core',
);

export { CAPABILITIES, PACKAGES };
export type { PublishedPackage, RuntimeManifest };
