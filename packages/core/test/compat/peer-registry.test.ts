import { expect, test } from 'bun:test';

import { loadPeer, registerPeer } from '#adapter/compat/peer-load';

const DECLARED = '@dudousxd/nestjs-inertia';
const RESOLVED = '@nestjs/common';
const ABSENT = '@nowhere/nestjs-absent-peer';

const fakePeer = { VERSION: '0.0.1' };

test('a declared peer is the answer', async () => {
  registerPeer(DECLARED, fakePeer);
  expect(await loadPeer(DECLARED)).toBe(fakePeer);
});

test('a peer that is not declared is still resolved', async () => {
  expect(await loadPeer(RESOLVED)).toBeDefined();
});

test('a peer that resolves nowhere is absent', async () => {
  expect(await loadPeer(ABSENT)).toBeUndefined();
});
