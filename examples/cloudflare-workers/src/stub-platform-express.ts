/**
 * Stand-in for the optional `@nestjs/platform-express` package.
 *
 * `@nestjs/core` calls
 * `tryLoadPackage('@nestjs/platform-express', ...)` and reads
 * no symbol from the result, so an empty module is enough to
 * let the bundler resolve Nest's lazy import. Nothing here is
 * used at runtime.
 */
export const platformExpressStub = true;
