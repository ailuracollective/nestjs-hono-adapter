import { expect, test } from 'bun:test';
import { bridgeNames } from '#adapter/compat/index';

import { request, startProbe } from '#test/probe';

import { staticModule } from './fixture.ts';

/** The path the fixture serves its files under. */
const PATH = '/static';

/** The status an answered file carries. */
const OK = 200;

/** The status a file that is not there carries. */
const NOT_FOUND = 404;

test('the region finds the installed bridge package on its own', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: staticModule(),
  });
  await probe.close();
  expect(bridgeNames()).toContain('serve-static');
});

test('a file the directory holds is answered', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: staticModule(),
  });
  try {
    const response = await request(probe, `${PATH}/hello.txt`);
    expect(response.status).toBe(OK);
    expect(response.text).toBe(
      'the loader answers the files a transport reads',
    );
  } finally {
    await probe.close();
  }
});

test('a file the directory does not hold is not answered', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: staticModule(),
  });
  try {
    const response = await request(probe, `${PATH}/absent.txt`);
    expect(response.status).toBe(NOT_FOUND);
  } finally {
    await probe.close();
  }
});

/** A hook the transport cannot honour, as a case writes one. */
const setHeaders = (): void => undefined;

test('setHeaders is refused rather than ignored', async () => {
  let refusal = '';
  try {
    const probe = await startProbe({
      mode: 'in-process',
      module: staticModule({ setHeaders }),
    });
    await probe.close();
  } catch (error) {
    refusal = String(error);
  }
  expect(refusal).toMatch(/setHeaders/u);
});
