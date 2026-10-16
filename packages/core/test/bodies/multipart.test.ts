import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

test('a multipart request fills the body and the files', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const form = new FormData();
    form.set('title', 'note');
    form.set('upload', new File(['bytes'], 'note.txt', { type: 'text/plain' }));
    const response = await request(probe, '/upload', {
      body: form,
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      body: { title: 'note' },
      files: ['upload'],
    });
  } finally {
    await probe.close();
  }
});
