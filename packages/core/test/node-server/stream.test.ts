import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import { Controller, Get, HttpStatus, Module, StreamableFile } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request, startProbe } from '#test/probe';
import type { ProbeResult } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from './fixture.ts';

interface CookieResponse {
  setHeader: (name: string, value: string | readonly string[]) => void;
}

const TEXT = 'chunk-1chunk-2';

class CookieMiddleware implements NestMiddleware {
  public use(_request: unknown, response: CookieResponse, next: () => void): void {
    response.setHeader('set-cookie', ['one=1; Path=/', 'two=2; Path=/']);
    response.setHeader('x-note', 'kept');
    next();
  }
}

const bytes = (): Readable =>
  Readable.from([Buffer.from('chunk-1'), Buffer.from('chunk-2')], { objectMode: false });

@Controller('stream')
class StreamController {
  @Get('file')
  public file(): StreamableFile {
    return new StreamableFile(bytes(), {
      disposition: 'attachment; filename="note.txt"',
      length: TEXT.length,
      type: 'text/plain',
    });
  }

  @Get('undeclared')
  public undeclared(): unknown {
    return { getHeaders: () => ({}), getStream: bytes };
  }

  @Get('object-mode')
  public objectMode(): StreamableFile {
    return new StreamableFile(Readable.from(['streamed']), { type: 'text/plain' });
  }
}

@Module({ controllers: [StreamController] })
class StreamModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CookieMiddleware).forRoutes('*');
  }
}

const expectFileAnswer = (response: ProbeResult): void => {
  expect(response.status).toBe(HttpStatus.OK);
  expect(response.text).toBe(TEXT);
  expect(response.contentType).toBe('text/plain');
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="note.txt"');
  expect(response.headers.get('content-length')).toBe(String(TEXT.length));
  expect(response.headers.getSetCookie()).toStrictEqual(['one=1; Path=/', 'two=2; Path=/']);
  expect(response.headers.get('x-note')).toBe('kept');
};

test('a StreamableFile is piped straight into the Node response', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: StreamModule });
  try {
    expectFileAnswer(await request(probe, '/stream/file'));
  } finally {
    await probe.close();
  }
});

test('a HEAD request keeps the stream headers and writes no body', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: StreamModule });
  try {
    const response = await request(probe, '/stream/file', { method: 'HEAD' });
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('');
    expect(response.contentType).toBe('text/plain');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="note.txt"');
  } finally {
    await probe.close();
  }
});

test('a stream with no declared type keeps the default the Web path answers', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: StreamModule });
  try {
    const response = await request(probe, '/stream/undeclared');
    expect(response.contentType).toBe('text/plain; charset=UTF-8');
    expect(response.text).toBe(TEXT);
  } finally {
    await probe.close();
  }
});

test('an object-mode stream still goes through the Web encoder', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: StreamModule });
  try {
    const response = await request(probe, '/stream/object-mode');
    expect(response.text).toBe('streamed');
    expect(response.contentType).toBe('text/plain');
  } finally {
    await probe.close();
  }
});

test('the Bun transport streams the same file', async () => {
  const probe = await startProbe({ module: StreamModule });
  try {
    expectFileAnswer(await request(probe, '/stream/file'));
  } finally {
    await probe.close();
  }
});
