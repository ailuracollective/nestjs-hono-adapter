import { describe, expect, test } from 'bun:test';

import {
  isMatcherPeer,
  isModulePeer,
  matcherOf,
  notFoundException,
  renderPath,
  rootPath,
  serveStaticModule,
} from '#serve-static/peer-read';

describe('isMatcherPeer', () => {
  test('returns true for an object with pathToRegexp function', () => {
    const peer = { pathToRegexp: (): { regexp: RegExp } => ({ regexp: /test/u }) };
    expect(isMatcherPeer(peer)).toBe(true);
  });

  test('returns false for null', () => {
    // oxlint-disable-next-line unicorn/no-null -- the reader answers the null a failed peer load hands it.
    expect(isMatcherPeer(null)).toBe(false);
  });

  test('returns false for non-object values', () => {
    expect(isMatcherPeer('string')).toBe(false);
  });

  test('returns false for objects without pathToRegexp', () => {
    const peer = {
      other: (): void => {
        /* Not a matcher peer */
      },
    };
    expect(isMatcherPeer(peer)).toBe(false);
  });
});

describe('isModulePeer', () => {
  test('returns true for an object with ServeStaticModule function', () => {
    const peer = {
      ServeStaticModule: class {
        public readonly marker = true;
      },
    };
    expect(isModulePeer(peer)).toBe(true);
  });

  test('returns false for null', () => {
    // oxlint-disable-next-line unicorn/no-null -- the reader answers the null a failed peer load hands it.
    expect(isModulePeer(null)).toBe(false);
  });

  test('returns false for objects without ServeStaticModule', () => {
    const peer = {
      other: (): void => {
        /* Not a module peer */
      },
    };
    expect(isModulePeer(peer)).toBe(false);
  });
});

describe('serveStaticModule', () => {
  test('returns undefined when serveStatic peer is not present', () => {
    expect(serveStaticModule({ pathToRegexp: undefined, serveStatic: undefined })).toBeUndefined();
  });

  test('returns ServeStaticModule when present', () => {
    const mod = class {
      public onModuleInit(): string {
        return 'initialized';
      }
    };
    expect(
      serveStaticModule({ pathToRegexp: undefined, serveStatic: { ServeStaticModule: mod } }),
    ).toBe(mod);
  });
});

describe('renderPath', () => {
  test('returns default path when serveStatic peer is absent', () => {
    expect(renderPath({ pathToRegexp: undefined, serveStatic: undefined })).toBe('{*any}');
  });

  test('returns custom path when present', () => {
    expect(
      renderPath({
        pathToRegexp: undefined,
        serveStatic: { DEFAULT_EXPRESS_RENDER_PATH: '/custom' },
      }),
    ).toBe('/custom');
  });

  test('returns default when the custom path is absent', () => {
    expect(renderPath({ pathToRegexp: undefined, serveStatic: {} })).toBe('{*any}');
  });
});

describe('rootPath', () => {
  test('returns default root when serveStatic peer is absent', () => {
    expect(rootPath({ pathToRegexp: undefined, serveStatic: undefined })).toBe('client');
  });

  test('returns custom root when present', () => {
    expect(
      rootPath({ pathToRegexp: undefined, serveStatic: { DEFAULT_ROOT_PATH: '/static' } }),
    ).toBe('/static');
  });
});

describe('notFoundException', () => {
  test('returns undefined when serveStatic peer is absent', () => {
    expect(notFoundException({ pathToRegexp: undefined, serveStatic: undefined })).toBeUndefined();
  });

  test('returns NotFoundException when present', () => {
    const exc = class {
      public getResponse(): unknown {
        return 'missing';
      }
    };
    expect(
      notFoundException({ pathToRegexp: undefined, serveStatic: { NotFoundException: exc } }),
    ).toBe(exc);
  });
});

describe('matcherOf', () => {
  test('returns undefined when pathToRegexp peer is absent', () => {
    expect(matcherOf({ pathToRegexp: undefined, serveStatic: undefined }, '/test')).toBeUndefined();
  });

  test('returns regexp when pathToRegexp peer is present', () => {
    const regexp = /test/u;
    const result = matcherOf(
      {
        pathToRegexp: { pathToRegexp: (): { regexp: RegExp } => ({ regexp }) },
        serveStatic: undefined,
      },
      '/test',
    );
    expect(result).toBe(regexp);
  });
});
