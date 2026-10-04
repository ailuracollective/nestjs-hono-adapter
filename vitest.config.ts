import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    /**
     * The tests build Nest applications, whose decorators are
     * the legacy kind, and `tsconfig.json` declares
     * `emitDecoratorMetadata` so the injector can read
     * constructor parameter types.
     *
     * Vitest's default transform reads `experimentalDecorators`
     * and drops the metadata, which leaves a declared flag with
     * nothing honouring it. swc honours both.
     */
    swc.vite({
      jsc: {
        parser: { decorators: true, syntax: 'typescript' },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
