import { Controller, HttpStatus, Module, Post, Req } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import type { NestRequest } from '#adapter/index';

import { request } from '#test/probe';
import { startProbe } from '#adapter-test/support/index';

// `graphql-upload` reads the body by streaming the request; the bag exposes that stream over the
// standard `Request.body`, and a body the middleware consumes is what the route then sees.
class StreamMiddleware implements NestMiddleware {
  public use(source: NestRequest, _response: unknown, next: () => void): void {
    const chunks: Buffer[] = [];
    source.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    source.stream.on('end', () => {
      source.body = Buffer.concat(chunks).toString();
      next();
    });
  }
}

@Controller()
class StreamController {
  @Post('stream')
  public stream(@Req() source: NestRequest): unknown {
    return { body: source.body };
  }
}

@Module({ controllers: [StreamController] })
class StreamModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(StreamMiddleware).forRoutes('*');
  }
}

test('a middleware streams the request body through NestRequest.stream', async () => {
  const probe = await startProbe({ mode: 'in-process', module: StreamModule });
  try {
    const response = await request(probe, '/stream', {
      body: 'streamed-request-body',
      headers: { 'content-type': 'multipart/form-data; boundary=----x' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ body: 'streamed-request-body' });
  } finally {
    await probe.close();
  }
});
