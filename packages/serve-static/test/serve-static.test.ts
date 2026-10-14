import { expect, test } from 'bun:test';
import { bridgeNames } from '#adapter/compat/index';

import { request, startProbe } from '#test/probe';

import { staticModule } from './fixture.ts';

const PATH = '/static';

const OK = 200;

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
    expect(response.text).toBe('the loader answers the files a transport reads');
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
