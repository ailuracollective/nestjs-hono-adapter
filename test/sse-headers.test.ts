import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { SseModule, startProbe } from './support.ts';
import type { Probe } from './probe.ts';

/**
 * What an event stream answers with, as the client sees it: the
 * status and the headers, rather than the frames.
 *
 * The frames themselves, and the connection an event stream
 * lives on, are the other file's business. These cases are
 * about the answer Nest builds around the stream, and every one
 * of them needs the stream to have opened at all, which only
 * happens on the `@Sse()` path.
 */

/** A probe with no listener, no port and no teardown. */
function streamedProbe(): Promise<Probe> {
  return startProbe({ mode: 'in-process', module: SseModule });
}

test('a handler that throws is answered by Nest', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/throws');
    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.headers.get('content-type')).toContain(
      'application/json',
    );
  } finally {
    await probe.close();
  }
});

test('an observable that errors before a frame is answered by Nest', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/errors');
    expect(response.status).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    await probe.close();
  }
});

/**
 * The one case here that answers over a socket rather than
 * in-process, and the reason is the claim it makes.
 *
 * Nest's own SSE path reads `res.raw` first and only then reads
 * `res.getHeaders?.()` and `res.statusCode`, so the stream
 * surface the adapter opens lazily has to be open by the time
 * those are read. Were it not, `additionalHeaders` would carry
 * nothing and the answer would come back as a plain body: the
 * stream's own content type gone, `@Header()` dropped and
 * `@HttpCode()` ignored. Only the socket path proves the getter
 * fired on a real connection, because only there does the
 * answer travel back through a transport that has to be given
 * the headers before the frames.
 */
test('a decorated stream answers with its own status and headers', async () => {
  const probe = await startProbe({ module: SseModule });
  try {
    const response = await probe.respond('/sse/decorated');
    // The one frame is read so the socket is drained before the
    // application is closed underneath it.
    await response.text();
    expect(response.status).toBe(HttpStatus.ACCEPTED);
    expect(response.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    expect(response.headers.get('x-stream')).toBe('yes');
  } finally {
    await probe.close();
  }
});
