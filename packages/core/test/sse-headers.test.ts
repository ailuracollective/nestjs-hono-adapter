import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { SseModule, startProbe } from './support/index.ts';
import type { Probe } from '#test/probe';

const streamedProbe = (): Promise<Probe> => startProbe({ mode: 'in-process', module: SseModule });

test('a handler that throws is answered by Nest', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/throws');
    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.headers.get('content-type')).toContain('application/json');
  } finally {
    await probe.close();
  }
});

test('an observable that errors before a frame is answered by Nest', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/errors');
    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  } finally {
    await probe.close();
  }
});

test('a decorated stream answers with its own status and headers', async () => {
  const probe = await startProbe({ module: SseModule });
  try {
    const response = await probe.respond('/sse/decorated');
    await response.text();
    expect(response.status).toBe(HttpStatus.ACCEPTED);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-stream')).toBe('yes');
  } finally {
    await probe.close();
  }
});
