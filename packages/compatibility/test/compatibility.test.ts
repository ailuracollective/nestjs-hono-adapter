import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { CLIENT_CASES } from './cases/clients.ts';
import { MESSAGING_CASES } from './cases/messaging.ts';
import { PERSISTENCE_CASES } from './cases/persistence.ts';
import type { CompatibilityCase } from './cases/types.ts';
import { withApp } from './support.ts';

const CASES: readonly CompatibilityCase[] = [
  ...CLIENT_CASES,
  ...MESSAGING_CASES,
  ...PERSISTENCE_CASES,
];

const TIMEOUT = 30_000;

for (const { module, name, options } of CASES) {
  test(
    `${name} boots on the adapter and serves a route`,
    async () => {
      await withApp(
        module,
        async (probe) => {
          const answer = await probe.request('/ping');
          expect(answer.status).toBe(HttpStatus.OK);
          expect(answer.body).toStrictEqual({ ok: true });
        },
        options ?? {},
      );
    },
    TIMEOUT,
  );
}
