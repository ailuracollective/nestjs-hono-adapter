import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import { ssrModule, ssrStreamModule } from './fixtures/ssr.ts';
import { INERTIA, OK, probeFor } from './support.ts';

test('the first load is server-rendered with head and body', async () => {
  const probe = await probeFor(ssrModule());
  try {
    const response = await request(probe, '/ssr');
    expect(response.status).toBe(OK);
    expect(response.text).toContain('<title>SSR</title>');
    expect(response.text).toContain('data-server-rendered="true"');
    expect(response.text).toContain('SSR:Ssr/Index');
    expect(response.text).not.toContain('<div id="app"></div>');
  } finally {
    await probe.close();
  }
});

test('an Inertia request stays JSON with SSR enabled', async () => {
  const probe = await probeFor(ssrModule());
  try {
    const response = await request(probe, '/ssr', { headers: INERTIA });
    expect(response.status).toBe(OK);
    expect(response.body).toMatchObject({
      component: 'Ssr/Index',
      props: { message: 'ssr' },
    });
  } finally {
    await probe.close();
  }
});

test('streaming SSR renders the body through the shell', async () => {
  const probe = await probeFor(ssrStreamModule());
  try {
    const response = await request(probe, '/ssr');
    expect(response.status).toBe(OK);
    expect(response.text).toContain('data-server-rendered="true"');
    expect(response.text).toContain('stream:Ssr/Index');
  } finally {
    await probe.close();
  }
});
