import type { Type } from '@nestjs/common';

import type { StartOptions } from '#compat-test/support';

/** One third-party Nest package the adapter has to serve a request for. */
interface CompatibilityCase {
  readonly module: Type<unknown>;
  readonly name: string;
  readonly options?: StartOptions;
}

export type { CompatibilityCase };
