import { resolve } from 'node:path';

import nestInertia from '@dudousxd/nestjs-inertia-vite/plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(import.meta.dirname, 'inertia/app.tsx'),
    },
  },
  plugins: [
    nestInertia({
      entry: 'inertia/app.tsx',
      react: true,
      root: '.',
    }),
  ],
});
