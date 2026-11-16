import type { ArgumentsHost, Type } from '@nestjs/common';

import { isWriter, run, runScoped, writeOf } from './validation-scope.ts';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.validation');

interface FilterPeer {
  readonly InertiaValidationFilter: Type<unknown>;
}

/**
 * The stock filter hands a FlashStore the framework request (`req.raw`), which on Hono is the
 * synthetic incoming carrier, while the read side hands it the Nest request. Give both sides the
 * Nest request so a session-keyed store sees one shape.
 */
const patchValidationFilter = (peer: FilterPeer): void => {
  const prototype: unknown = Reflect.get(peer.InertiaValidationFilter, 'prototype');
  if (typeof prototype !== 'object' || prototype === null) return;
  if (Reflect.get(prototype, PATCHED) === true) return;
  Reflect.set(prototype, PATCHED, true);

  const original: unknown = Reflect.get(prototype, 'catch');
  if (!isWriter(original)) return;
  Reflect.set(
    prototype,
    'catch',
    function catchFilter(this: object, exception: unknown, host: ArgumentsHost): unknown {
      const options: unknown = Reflect.get(this, 'options');
      if (typeof options !== 'object' || options === null) {
        return run({ exception, filter: this, host, original });
      }
      const target = writeOf(options);
      if (target === undefined) return run({ exception, filter: this, host, original });
      return runScoped({
        exception,
        filter: this,
        host,
        options,
        original,
        store: target.store,
        write: target.write,
      });
    },
  );
};

export { patchValidationFilter };
