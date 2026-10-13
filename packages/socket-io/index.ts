/**
 * The `./socket-io` subpath the root still serves, emitted from
 * here: keeping the entrypoint is what spares every consumer an
 * import change, and emitting it from this package is what
 * spares the core a dependency on it.
 */
export * from './src/index.ts';
