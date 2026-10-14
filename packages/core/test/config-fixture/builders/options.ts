import type { Type } from '@nestjs/common';

import type { ProbeOptions } from '#test/probe';

const configured = (
  module: Type<unknown>,
  mode: ProbeOptions['mode'] = 'in-process',
): ProbeOptions => ({ mode, module });

export { configured };
