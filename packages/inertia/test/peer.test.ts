import { expect, test } from 'bun:test';

import { assertSupported } from '#inertia/peer';

test('an Inertia 3.x peer is accepted', () => {
  expect(() => {
    assertSupported('3.0.1');
  }).not.toThrow();
});

test('an Inertia peer outside 3.x is refused with its version named', () => {
  expect(() => {
    assertSupported('2.0.1');
  }).toThrow(/2\.0\.1/u);
  expect(() => {
    assertSupported('4.0.0');
  }).toThrow(/4\.0\.0/u);
});
