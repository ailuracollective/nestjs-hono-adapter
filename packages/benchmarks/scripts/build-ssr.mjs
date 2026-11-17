import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { compileScript, parse } from '@vue/compiler-sfc';
import { compile, compileModule } from 'svelte/compiler';

/** Synchronous filesystem bridge so `compileScript` can resolve imported prop types. */
const fs = {
  fileExists: (file) => existsSync(file),
  readFile: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined),
};

/** Compile the Svelte sources `@inertiajs/svelte` ships for bundlers. */
const svelteSsr = {
  name: 'svelte-ssr',
  setup(build) {
    build.onLoad({ filter: /\.svelte$/u }, async ({ path }) => {
      const source = await readFile(path, 'utf8');
      const { js } = compile(source, { filename: path, generate: 'server' });
      return { contents: js.code, loader: 'js' };
    });
    build.onLoad({ filter: /\.svelte\.js$/u }, async ({ path }) => {
      const source = await readFile(path, 'utf8');
      const { js } = compileModule(source, { filename: path, generate: 'server' });
      return { contents: js.code, loader: 'js' };
    });
  },
};

/** Compile Vue single-file components into SSR render functions. */
const vueSfc = {
  name: 'vue-sfc',
  setup(build) {
    build.onLoad({ filter: /\.vue$/u }, async ({ path }) => {
      const source = await readFile(path, 'utf8');
      const { descriptor, errors } = parse(source, { filename: path });
      if (errors.length > 0) throw new Error(`Cannot parse ${path}: ${errors[0].message}`);
      const id = createHash('sha256').update(path).digest('hex').slice(0, 8);
      const { content } = compileScript(descriptor, {
        fs,
        id,
        inlineTemplate: true,
        templateOptions: { ssr: true },
      });
      return { contents: content, loader: 'ts' };
    });
  },
};

const builds = [
  {
    entrypoints: ['src/app/ssr/svelte.ts'],
    naming: 'svelte.bundle.js',
    plugins: [svelteSsr],
    conditions: ['svelte'],
  },
  {
    entrypoints: ['src/app/ssr/vue.ts'],
    naming: 'vue.bundle.js',
    plugins: [vueSfc],
    packages: 'external',
  },
];

for (const { entrypoints, naming, plugins, ...options } of builds) {
  const result = await Bun.build({
    ...options,
    entrypoints,
    outdir: 'dist/app/ssr',
    naming,
    target: 'node',
    format: 'esm',
    plugins,
  });
  if (!result.success) {
    throw new Error(`SSR bundle ${naming} failed:\n${result.logs.join('\n')}`);
  }
}
