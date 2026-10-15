import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startProbe } from '#adapter-test/support/index';

// Express middleware reaches for the request the Express way: `req.is()` gates
// `graphql-upload`, and Vendure reads the session token with `req.get('Authorization')`.

test('req.is() reports the declared content type', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/express', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    expect(response.body).toStrictEqual({
      isJson: 'application/json',
      isMultipart: false,
    });
  } finally {
    await probe.close();
  }
});

test('req.is() matches a multipart declaration', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/express', {
      headers: { 'content-type': 'multipart/form-data; boundary=----x' },
    });
    expect(response.body).toMatchObject({ isMultipart: 'multipart/form-data' });
  } finally {
    await probe.close();
  }
});

test('req.get() reads a header case-insensitively', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/express', {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.body).toMatchObject({ authorization: 'Bearer token' });
  } finally {
    await probe.close();
  }
});
