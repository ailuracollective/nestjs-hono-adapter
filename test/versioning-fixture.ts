/**
 * The fixture the versioning cases build against: the modules
 * whose versioned routes a case asks for, and the probe options
 * that mount each of them.
 *
 * There are three of them because `enableVersioning` is a
 * choice an application makes once: a route read from `Accept`
 * cannot be served by an application that reads its version
 * from a header. The probe that builds them lives in
 * `probe.ts`.
 */
import 'reflect-metadata';

import {
  Controller,
  Get,
  Module,
  VERSION_NEUTRAL,
  Version,
  VersioningType,
} from '@nestjs/common';
import type {
  INestApplication,
  Type,
  VersioningOptions,
} from '@nestjs/common';

import type { ProbeOptions } from './probe.ts';

/** The path the versions of a media-type route share. */
const MEDIA_PATH = '/media';

/** The path the versions of a header route share. */
const HEADER_PATH = '/header';

/** The header a header-versioned application reads. */
const VERSION_HEADER = 'x-api-version';

/**
 * The routes a media-type application serves. Every version of
 * a route sits on one path, so the order they are registered in
 * is the order a request meets them: a request answered by the
 * last one reached every filter in front of it first.
 */
@Controller(MEDIA_PATH)
class MediaTypeController {
  @Get()
  @Version('1')
  public first(): unknown {
    return { served: '1' };
  }

  @Get()
  @Version('2')
  public second(): unknown {
    return { served: '2' };
  }

  /**
   * Registered last, so the only requests it answers are the
   * ones the two versioned routes above passed on.
   */
  @Get()
  @Version(VERSION_NEUTRAL)
  public neutral(): unknown {
    return { served: 'neutral' };
  }

  /**
   * The neutral marker can also sit in a list beside named
   * versions, which is the form the filter has to read.
   */
  @Get('list')
  @Version([VERSION_NEUTRAL, '1'])
  public neutralOrFirst(): unknown {
    return { served: 'neutral-or-1' };
  }
}

/** A route read from a named header rather than from `Accept`. */
@Controller(HEADER_PATH)
class HeaderController {
  @Get()
  @Version('1')
  public first(): unknown {
    return { served: '1' };
  }
}

@Module({ controllers: [MediaTypeController] })
class MediaTypeModule {}

@Module({ controllers: [HeaderController] })
class HeaderModule {}

/**
 * The probe options for a module whose routes are versioned the
 * way the options say.
 */
function versioned(
  module: Type<unknown>,
  options: VersioningOptions,
): ProbeOptions {
  return {
    configure: (app: INestApplication) => {
      app.enableVersioning(options);
    },
    module,
  };
}

/**
 * A probe reading the version out of `Accept`, where it is a
 * parameter of a media range rather than a header of its own.
 */
const MEDIA_TYPE_PROBE = versioned(MediaTypeModule, {
  key: 'v=',
  type: VersioningType.MEDIA_TYPE,
});

/**
 * The same application with a key written the other way round,
 * `v+=`, which has to name the same parameter.
 */
const PLUS_KEY_PROBE = versioned(MediaTypeModule, {
  key: 'v+=',
  type: VersioningType.MEDIA_TYPE,
});

/** A probe reading the version out of a header of its own. */
const HEADER_PROBE = versioned(HeaderModule, {
  header: VERSION_HEADER,
  type: VersioningType.HEADER,
});

export {
  HEADER_PATH,
  HEADER_PROBE,
  MEDIA_PATH,
  MEDIA_TYPE_PROBE,
  PLUS_KEY_PROBE,
  VERSION_HEADER,
};
