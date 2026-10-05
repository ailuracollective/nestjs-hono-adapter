import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ResponseModule } from './response-fixture.ts';
import { startProbe } from './support.ts';
import { request } from './probe.ts';

test('a handler that answers through @Res() writes its response', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/imperative',
    );
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      imperative: true,
    });
  } finally {
    await probe.close();
  }
});

/**
 * The surface an event stream is written into belongs to
 * `@Sse()` alone. A handler that answers an ordinary route
 * through the response object must get its own answer: a
 * writable that commits `text/event-stream` with the stream's
 * own headers answers every route as a stream, whatever the
 * route wrote and whatever content type it meant to send.
 */
test('an ordinary @Res() route is not answered as an event stream', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/writer');
    expect(response.contentType).not.toContain(
      'text/event-stream',
    );
    expect(response.headers.get('cache-control')).toBeNull();
    expect(response.headers.get('connection')).toBeNull();
    expect(
      response.headers.get('x-accel-buffering'),
    ).toBeNull();
  } finally {
    await probe.close();
  }
});

/**
 * A handler that returns raw bytes and names no type, so the
 * binary branch of the answer is what reaches the client. A
 * body of bytes with no type is `application/octet-stream`, the
 * way Fastify labels it: the other platform adapter serialises
 * it as JSON instead, which is the one answer that loses the
 * bytes.
 */
test('raw bytes are answered as a binary body', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/bytes');
    expect(response.contentType).toBe(
      'application/octet-stream',
    );
    expect(response.text).toBe('raw');
  } finally {
    await probe.close();
  }
});

test('a passthrough @Res() keeps the headers it set', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/passthrough',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('x-passthrough')).toBe('yes');
    expect(response.body).toStrictEqual({
      passthrough: true,
    });
  } finally {
    await probe.close();
  }
});

test('@Header() and @HttpCode() reach the answer', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/decorated',
    );
    expect(response.status).toBe(HttpStatus.ACCEPTED);
    expect(response.headers.get('x-decorated')).toBe('yes');
  } finally {
    await probe.close();
  }
});

/**
 * A handler declared `@HttpCode(HttpStatus.NO_CONTENT)` may
 * still return a value, and every other Nest adapter answers
 * the status alone. The `Response` constructor throws on that
 * pair instead, so the throw reaches the client as a 500.
 */
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

/**
 * A status that forbids a body forbids it for every value, so
 * one handler shape per branch is what pins the family: a
 * primitive reaches the text branch and an object the JSON one,
 * and a fix that covered only one of them would still answer
 * the other with a 500.
 */
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

/**
 * The fixture is an object-mode stream of a string, and a web
 * response only reads `Uint8Array` chunks. This case earns the
 * fast path because it is the one place that has to hold: the
 * Node writer that serves a real connection tolerates a string
 * chunk, so a socket case would pass while the body stayed
 * unreadable in every runtime that reads it as bytes.
 */
test('a StreamableFile is streamed with its headers', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/file');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/plain');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="note.txt"',
    );
    expect(response.text).toBe('streamed');
  } finally {
    await probe.close();
  }
});

/**
 * A handler that declares the type it means to send has said
 * what the answer is, and the shape of the value it returned is
 * the adapter's business rather than the handler's. A rule that
 * only held for a string body would be a rule about the shape
 * of the value, not about the declaration.
 */
test('a declared content type wins over the inferred one', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/declared-type',
    );
    expect(response.contentType).toBe('application/xml');
  } finally {
    await probe.close();
  }
});

/**
 * The other half of the rule: with nothing declared the type
 * the adapter infers is the answer, which is what the clients
 * of an object body rely on.
 */
test('a value with no declared type is answered as JSON', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/inferred-type',
    );
    expect(response.contentType).toBe(
      'application/json; charset=UTF-8',
    );
    expect(response.body).toStrictEqual({ inferred: 'json' });
  } finally {
    await probe.close();
  }
});

/**
 * The declaration is honoured on a primitive too, and it was
 * before this rule was written: the text branch already read it
 * before defaulting, and this pins that it still does.
 */
test('a declared content type is honoured on a string body', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(
      probe,
      '/response/declared-type-text',
    );
    expect(response.contentType).toBe('text/csv');
    expect(response.text).toBe('a,b');
  } finally {
    await probe.close();
  }
});
