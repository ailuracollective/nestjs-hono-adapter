import { expect, test } from 'bun:test';

import { assertInertiaVersion, supportsInertia } from '#inertia/version';

const SUPPORTED = '3.0.1';
const PREVIOUS = '2.9.0';
const NEXT = '4.0.0';

test('the 3.x line is supported', () => {
  expect(supportsInertia(SUPPORTED)).toBe(true);
});

test('another major is refused', () => {
  expect(supportsInertia(PREVIOUS)).toBe(false);
  expect(supportsInertia(NEXT)).toBe(false);
});

test('the assertion names the version it refuses', () => {
  expect(() => {
    assertInertiaVersion(PREVIOUS);
  }).toThrow(/2\.9\.0/u);
});
