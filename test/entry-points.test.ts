import path from 'node:path';

import { expect, test } from 'bun:test';

import coreManifest from '#root/packages/core/package.json' with { type: 'json' };

import {
  CAPABILITIES,
  CORE_NAME,
  DEFAULT_SERVER,
  ENTRY,
  MULTIPART_ENTRY,
  PLATFORM_NAMES,
  PLATFORM_PREFIX,
  SOCKET_IO_ENTRY,
  SOCKET_IO_PEER,
  UPLOAD_PARSER,
  WS_ENTRY,
} from './entry-points/packages.ts';
import {
  OTHER_ENTRY_POINTS,
  capabilitiesDeclaredBy,
  carriersOf,
  declaredBy,
  peersReachedBy,
  reachable,
} from './entry-points/sources/index.ts';

test('the adapter declares none of the capability packages', () => {
  expect(capabilitiesDeclaredBy(coreManifest)).toStrictEqual(
    [],
  );
});

test('no capability package declares another', () => {
  const declared = CAPABILITIES.flatMap((pkg) =>
    capabilitiesDeclaredBy(pkg.manifest).map(
      (name) => `${pkg.name} -> ${name}`,
    ),
  );
  expect(declared).toStrictEqual([]);
});

test('the check reads a declaration, so an empty answer is not a pass', () => {
  const carriers = CAPABILITIES.filter((pkg) =>
    declaredBy(pkg.manifest).includes(CORE_NAME),
  ).map((pkg) => pkg.name);
  expect(carriers).toContain(`${PLATFORM_PREFIX}ws`);
});

test('the adapter publishes its four entry points', () => {
  expect(coreManifest.name).toBe(CORE_NAME);
  expect(
    Object.keys(coreManifest.exports).toSorted(),
  ).toStrictEqual([
    '.',
    './bun-server',
    './fetch',
    './node-server',
  ]);
});

test('each platform package publishes one entry point', () => {
  expect(
    CAPABILITIES.map((pkg) => pkg.name).toSorted(),
  ).toStrictEqual(PLATFORM_NAMES);
  for (const pkg of CAPABILITIES) {
    expect(Object.keys(pkg.exports)).toStrictEqual(['.']);
  }
});

test('the HTTP entry point reaches no websocket peer', async () => {
  const files = await reachable(ENTRY);
  expect(files.length).toBeGreaterThan(1);
  expect(await peersReachedBy(ENTRY)).toStrictEqual([]);
});

test('the HTTP entry point reaches the server it serves by default', async () => {
  const carriers = await carriersOf(ENTRY, DEFAULT_SERVER);
  expect(carriers.length).toBeGreaterThan(0);
  const names = carriers.map((file) => path.basename(file));
  expect(names).toContain('bun.ts');
});

test('the WebSocket entry point does reach the island peers', async () => {
  const peerFiles = await peersReachedBy(WS_ENTRY);
  const names = peerFiles.map((file) => path.basename(file));
  expect(names).toContain('adapter.ts');
});

test.each(OTHER_ENTRY_POINTS)(
  '%s reaches no socket.io peer',
  async (_name, source) => {
    expect(
      await carriersOf(source, SOCKET_IO_PEER),
    ).toStrictEqual([]);
  },
);

test('the socket.io entry point does reach socket.io', async () => {
  const carriers = await carriersOf(
    SOCKET_IO_ENTRY,
    SOCKET_IO_PEER,
  );
  const names = carriers.map((file) => path.basename(file));
  expect(names).toContain('adapter.ts');
});

test('the HTTP entry point reaches no upload parser', async () => {
  expect(await carriersOf(ENTRY, UPLOAD_PARSER)).toStrictEqual(
    [],
  );
});

test('the multipart entry point does reach the upload parser', async () => {
  const carriers = await carriersOf(
    MULTIPART_ENTRY,
    UPLOAD_PARSER,
  );
  expect(carriers.length).toBeGreaterThan(0);
});
