import { describe, expect, test } from 'bun:test';
import { RequestMethod } from '@nestjs/common';

import { RouteAdapter } from '#adapter/core/route/route-adapter';

class TestAdapter extends RouteAdapter {
  public registered: { method: string; path: string }[] = [];
  public mounted: { path: string }[] = [];

  protected override register(method: string, path: string): void {
    this.registered.push({ method, path });
  }

  protected override mount(path: string): void {
    this.mounted.push({ path });
  }

  // Satisfy abstract requirements from AbstractHttpAdapter
  public override getHttpServer(): never {
    throw new Error('not implemented');
  }

  public override setHttpServer(_server: unknown): void {
    throw new Error('not implemented');
  }

  public override getInstance(): never {
    throw new Error('not implemented');
  }

  public override init(): Promise<void> {
    throw new Error('not implemented');
  }

  public override listen(..._args: unknown[]): Promise<never> {
    throw new Error('not implemented');
  }

  public override close(): Promise<void> {
    throw new Error('not implemented');
  }

  public override setViewEngine(_engine: string): void {
    throw new Error('not implemented');
  }

  public override registerParserMiddleware(_prefix?: string, _rawBody?: boolean): void {
    throw new Error('not implemented');
  }

  public override enableCors(_options?: unknown, _prefix?: string): void {
    throw new Error('not implemented');
  }

  public override initHttpServer(_options: unknown): void {
    throw new Error('not implemented');
  }

  public override useStaticAssets(..._args: unknown[]): void {
    throw new Error('not implemented');
  }

  public override getRequestHostname(_request: unknown): never {
    throw new Error('not implemented');
  }

  public override getRequestMethod(_request: unknown): never {
    throw new Error('not implemented');
  }

  public override getRequestUrl(_request: unknown): never {
    throw new Error('not implemented');
  }

  public override status(_response: unknown, _statusCode: number): void {
    throw new Error('not implemented');
  }

  public override reply(_response: unknown, _body: unknown, _statusCode?: number): void {
    throw new Error('not implemented');
  }

  public override end(_response: unknown, _message?: string): void {
    throw new Error('not implemented');
  }

  public override render(_response: unknown, _view: string, _options: unknown): Promise<void> {
    throw new Error('not implemented');
  }

  public override redirect(_response: unknown, _statusCode: number, _url: string): void {
    throw new Error('not implemented');
  }

  public override setErrorHandler(_handler: unknown, _prefix?: string): void {
    throw new Error('not implemented');
  }

  public override setNotFoundHandler(
    _handler: unknown,
    _prefix?: string,
    _excludedRoutes?: unknown,
  ): void {
    throw new Error('not implemented');
  }

  public override isHeadersSent(_response: unknown): never {
    throw new Error('not implemented');
  }

  public override getHeader(_response: unknown, _name: string): never {
    throw new Error('not implemented');
  }

  public override setHeader(_response: unknown, _name: string, _value: string): void {
    throw new Error('not implemented');
  }

  public override appendHeader(_response: unknown, _name: string, _value: string): void {
    throw new Error('not implemented');
  }

  public override getType(): never {
    throw new Error('not implemented');
  }
}

const makeAdapter = (): TestAdapter => new TestAdapter();

const handler = (): Promise<void> => Promise.resolve();

describe('RouteAdapter HTTP methods', () => {
  test('get registers GET method', () => {
    const adapter = makeAdapter();
    adapter.get('/hello', handler);
    expect(adapter.registered).toContainEqual({ method: 'GET', path: '/hello' });
  });

  test('post registers POST method', () => {
    const adapter = makeAdapter();
    adapter.post('/users', handler);
    expect(adapter.registered).toContainEqual({ method: 'POST', path: '/users' });
  });

  test('put registers PUT method', () => {
    const adapter = makeAdapter();
    adapter.put('/users/1', handler);
    expect(adapter.registered).toContainEqual({ method: 'PUT', path: '/users/1' });
  });

  test('patch registers PATCH method', () => {
    const adapter = makeAdapter();
    adapter.patch('/users/1', handler);
    expect(adapter.registered).toContainEqual({ method: 'PATCH', path: '/users/1' });
  });

  test('delete registers DELETE method', () => {
    const adapter = makeAdapter();
    adapter.delete('/users/1', handler);
    expect(adapter.registered).toContainEqual({ method: 'DELETE', path: '/users/1' });
  });

  test('options registers OPTIONS method', () => {
    const adapter = makeAdapter();
    adapter.options('/resource', handler);
    expect(adapter.registered).toContainEqual({ method: 'OPTIONS', path: '/resource' });
  });

  test('head registers HEAD method', () => {
    const adapter = makeAdapter();
    adapter.head('/resource', handler);
    expect(adapter.registered).toContainEqual({ method: 'HEAD', path: '/resource' });
  });
});

describe('RouteAdapter extension methods', () => {
  test('all registers ALL method', () => {
    const adapter = makeAdapter();
    adapter.all('/any', handler);
    expect(adapter.registered).toContainEqual({ method: 'ALL', path: '/any' });
  });

  test('search registers SEARCH method', () => {
    const adapter = makeAdapter();
    adapter.search('/find', handler);
    expect(adapter.registered).toContainEqual({ method: 'SEARCH', path: '/find' });
  });

  test('query registers QUERY method', () => {
    const adapter = makeAdapter();
    adapter.query('/data', handler);
    expect(adapter.registered).toContainEqual({ method: 'QUERY', path: '/data' });
  });
});

describe('RouteAdapter WebDAV methods', () => {
  test('propfind registers PROPFIND method', () => {
    const adapter = makeAdapter();
    adapter.propfind('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'PROPFIND', path: '/webdav' });
  });

  test('proppatch registers PROPPATCH method', () => {
    const adapter = makeAdapter();
    adapter.proppatch('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'PROPPATCH', path: '/webdav' });
  });

  test('mkcol registers MKCOL method', () => {
    const adapter = makeAdapter();
    adapter.mkcol('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'MKCOL', path: '/webdav' });
  });

  test('copy registers COPY method', () => {
    const adapter = makeAdapter();
    adapter.copy('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'COPY', path: '/webdav' });
  });

  test('move registers MOVE method', () => {
    const adapter = makeAdapter();
    adapter.move('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'MOVE', path: '/webdav' });
  });

  test('lock registers LOCK method', () => {
    const adapter = makeAdapter();
    adapter.lock('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'LOCK', path: '/webdav' });
  });

  test('unlock registers UNLOCK method', () => {
    const adapter = makeAdapter();
    adapter.unlock('/webdav', handler);
    expect(adapter.registered).toContainEqual({ method: 'UNLOCK', path: '/webdav' });
  });
});

describe('RouteAdapter.use', () => {
  test('mounts a handler-only middleware at EVERY_PATH', () => {
    const adapter = makeAdapter();
    adapter.use(handler);
    expect(adapter.mounted).toContainEqual({ path: '*' });
  });

  test('mounts a path+handler middleware at the given path', () => {
    const adapter = makeAdapter();
    adapter.use('/api', handler);
    expect(adapter.mounted).toContainEqual({ path: '/api/*' });
  });

  test('throws when use is called with invalid arguments', () => {
    const adapter = makeAdapter();
    expect((): void => {
      adapter.use('/only-path');
    }).toThrow(TypeError);
  });
});

describe('RouteAdapter.createMiddlewareFactory', () => {
  test('creates middleware for a specific method', () => {
    const adapter = makeAdapter();
    const factory = adapter.createMiddlewareFactory(RequestMethod.GET);
    factory('/items', handler);
    expect(adapter.registered).toContainEqual({ method: 'GET', path: '/items' });
  });

  test('creates middleware for ALL method when RequestMethod.ALL', () => {
    const adapter = makeAdapter();
    const factory = adapter.createMiddlewareFactory(RequestMethod.ALL);
    factory('/items', handler);
    expect(adapter.mounted).toContainEqual({ path: '/items/*' });
  });

  test('throws when middleware is not a function', () => {
    const adapter = makeAdapter();
    const factory = adapter.createMiddlewareFactory(RequestMethod.GET);
    expect((): void => {
      factory('/items', 'not-a-function');
    }).toThrow(TypeError);
  });
});
