import * as nodeModule from 'module';

/**
 * A `createRequire` that tolerates a runtime without `import.meta.url`.
 *
 * `@nestjs/swagger` builds its require at module scope:
 * `createRequire(import.meta.url)`. A bundled Worker leaves
 * `import.meta.url` undefined (cloudflare/workerd#6986), so that call
 * throws before a line of the Worker runs. Defaulting the argument to a
 * file URL keeps the require constructible; a real URL passes through
 * untouched. Aliased onto `node:module` in `wrangler.jsonc`, because
 * `wrangler preview` does not apply the `define` that hides this for
 * `deploy` and `versions upload`.
 */
export function createRequire(
  filename?: string | URL,
): ReturnType<typeof nodeModule.createRequire> {
  return nodeModule.createRequire(filename ?? 'file:///worker.js');
}
