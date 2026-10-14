import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ResponseModule } from '#adapter-test/response-fixture';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

test('a status that forbids a body answers without one', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/no-content',
    );
    expect(response.status).toBe(HttpStatus.NO_CONTENT);
    expect(response.text).toBe('');
  } finally {
    await probe.close();
  }
});

test('a null-body status drops the string a handler returned', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/no-content-text',
    );
    expect(response.status).toBe(HttpStatus.NO_CONTENT);
    expect(response.text).toBe('');
  } finally {
    await probe.close();
  }
});

test('a reset status drops the object a handler returned', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/reset-content',
    );
    expect(response.status).toBe(HttpStatus.RESET_CONTENT);
    expect(response.text).toBe('');
  } finally {
    await probe.close();
  }
});

test('a not-modified status drops the object it returned', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/not-modified',
    );
    expect(response.status).toBe(HttpStatus.NOT_MODIFIED);
    expect(response.text).toBe('');
  } finally {
    await probe.close();
  }
});

test('@Redirect() answers with the status and the location', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/redirect',
      { redirect: 'manual' },
    );
    expect(response.status).toBe(HttpStatus.MOVED_PERMANENTLY);
    expect(response.headers.get('location')).toBe(
      'https://example.com/',
    );
  } finally {
    await probe.close();
  }
});
