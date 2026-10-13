import { expect, test } from 'bun:test';

/** A separate process keeps the runtime simulation isolated. */
const FIXTURE = new URL(
  'fixtures/unsupported-charset.ts',
  import.meta.url,
).pathname;

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
