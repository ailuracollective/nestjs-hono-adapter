import { expect, test } from 'bun:test';

import { assertNoHooks } from '#serve-static/options';
import { isRouteExcluded } from '#serve-static/exclude';
import type { Peers } from '#serve-static/peer-shapes';

const PREFIX = '/static';

const WITHOUT_MATCHER: Peers = {
  pathToRegexp: undefined,
  serveStatic: undefined,
};

test('no hooks is the only configuration accepted', () => {
  expect(() => {
    assertNoHooks({});
  }).not.toThrow();
  expect(() => {
    assertNoHooks({
      serveStaticOptions: { fallthrough: true },
    });
  }).not.toThrow();
});

const setHeaders = (): void => undefined;

test('setHeaders is refused, because it wants an fs.Stats', () => {
  expect(() => {
    assertNoHooks({ serveStaticOptions: { setHeaders } });
  }).toThrow(/cannot honour the static asset option setHeaders/u);
});

test('a route under the prefix is excluded, one outside it is not', () => {
  expect(isRouteExcluded(WITHOUT_MATCHER, '/static/app.js', [PREFIX])).toBe(true);
  expect(isRouteExcluded(WITHOUT_MATCHER, '/assets/app.js', [PREFIX])).toBe(false);
});
