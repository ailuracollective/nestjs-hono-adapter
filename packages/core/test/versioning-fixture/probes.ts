import { VersioningType } from '@nestjs/common';
import type { INestApplication, Type, VersioningOptions } from '@nestjs/common';

import type { ProbeOptions } from '#test/probe';

import { HeaderModule, MediaTypeModule, VERSION_HEADER } from './controllers.ts';

const versioned = (module: Type<unknown>, options: VersioningOptions): ProbeOptions => ({
  configure: (app: INestApplication) => {
    app.enableVersioning(options);
  },
  module,
});

const MEDIA_TYPE_PROBE = versioned(MediaTypeModule, {
  key: 'v=',
  type: VersioningType.MEDIA_TYPE,
});

const PLUS_KEY_PROBE = versioned(MediaTypeModule, {
  key: 'v+=',
  type: VersioningType.MEDIA_TYPE,
});

const HEADER_PROBE = versioned(HeaderModule, {
  header: VERSION_HEADER,
  type: VersioningType.HEADER,
});

export { HEADER_PROBE, MEDIA_TYPE_PROBE, PLUS_KEY_PROBE };
