import { expect, test } from 'bun:test';

import { fileURLToPath } from 'node:url';

/**
 * A separate process keeps the runtime simulation isolated. The
 * path is spelled the way the filesystem does, so a checkout
 * whose directory carries a space or a non-ASCII character
 * still finds the fixture.
 */
const FIXTURE = fileURLToPath(
  new URL('fixtures/unsupported-charset.ts', import.meta.url),
);

test('a runtime without UTF-16BE starts and answers unsupported requests with 415', async () => {
  const child = Bun.spawn([process.execPath, 'test', FIXTURE], {
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [status, errors] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  expect(errors).not.toContain('(fail)');
  expect(status).toBe(0);
});
