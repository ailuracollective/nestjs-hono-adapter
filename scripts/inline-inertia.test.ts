import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { inlineInertia } from './inline-inertia.ts';

test('inlines the root view and the Vite build into one generated module', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'inline-inertia-'));
  const client = path.join(root, 'dist', 'inertia', 'client');
  const inertia = path.join(root, 'inertia');
  const source = path.join(root, 'src');
  try {
    mkdirSync(path.join(client, '.vite'), { recursive: true });
    mkdirSync(path.join(client, 'assets'), { recursive: true });
    mkdirSync(inertia, { recursive: true });
    mkdirSync(source, { recursive: true });
    writeFileSync(
      path.join(inertia, 'root.html'),
      '<div id="app"></div>@vite(\'inertia/app.tsx\')',
    );
    writeFileSync(
      path.join(client, '.vite', 'manifest.json'),
      JSON.stringify({
        'inertia/app.tsx': { css: ['assets/app.css'], file: 'assets/app.js' },
      }),
    );
    writeFileSync(path.join(client, 'assets', 'app.js'), 'console.log("app");');
    writeFileSync(path.join(client, 'assets', 'app.css'), 'body{margin:0}');

    await inlineInertia(root);

    const generated = readFileSync(path.join(source, 'inertia.generated.ts'), 'utf8');
    expect(generated).toContain(
      String.raw`export const ROOT_VIEW = "<div id=\"app\"></div><style>body{margin:0}</style>`,
    );
    expect(generated).toContain(String.raw`<script type=\"module\">console.log(\"app\");</script>`);
    expect(generated).not.toContain('@vite');
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
