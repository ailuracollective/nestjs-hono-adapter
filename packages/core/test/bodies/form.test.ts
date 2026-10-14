import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

test('a form body is parsed flat, as a query string is', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/echo', {
      body: 'ids=1&ids=2&filter[name]=x',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      'filter[name]': 'x',
      ids: ['1', '2'],
    });
  } finally {
    await probe.close();
  }
});

test('brackets in a form body stay literal keys', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/echo', {
      body: 'alpha[beta][gamma][delta][epsilon][zeta][eta]=h',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      'alpha[beta][gamma][delta][epsilon][zeta][eta]': 'h',
    });
  } finally {
    await probe.close();
  }
});

test('a query string reaches @Query() with its lists', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/query?ids=1&ids=2&filter[name]=x&page=3');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      'filter[name]': 'x',
      ids: ['1', '2'],
      page: '3',
    });
  } finally {
    await probe.close();
  }
});
