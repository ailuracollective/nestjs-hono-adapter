import 'reflect-metadata';

import {
  Controller,
  Get,
  Module,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';

/** The path the versions of a media-type route share. */
const MEDIA_PATH = '/media';

/** The path the versions of a header route share. */
const HEADER_PATH = '/header';

/** The header a header-versioned application reads. */
const VERSION_HEADER = 'x-api-version';

/** The controller serving every version of the media routes. */
@Controller(MEDIA_PATH)
class MediaTypeController {
  /** Answers with the first version. */
  @Get()
  @Version('1')
  public first(): unknown {
    return { served: '1' };
  }

  /** Answers with the second version. */
  @Get()
  @Version('2')
  public second(): unknown {
    return { served: '2' };
  }

  /** Answers the requests the versioned routes pass on. */
  @Get()
  @Version(VERSION_NEUTRAL)
  public neutral(): unknown {
    return { served: 'neutral' };
  }

  /** Answers for the neutral marker and the first version. */
  @Get('list')
  @Version([VERSION_NEUTRAL, '1'])
  public neutralOrFirst(): unknown {
    return { served: 'neutral-or-1' };
  }
}

/** A route read from a named header rather than from `Accept`. */
@Controller(HEADER_PATH)
class HeaderController {
  /** Answers with the first version. */
  @Get()
  @Version('1')
  public first(): unknown {
    return { served: '1' };
  }
}

/** The module declaring the media-type controller. */
@Module({ controllers: [MediaTypeController] })
class MediaTypeModule {}

/** The module declaring the header controller. */
@Module({ controllers: [HeaderController] })
class HeaderModule {}

export {
  HEADER_PATH,
  HeaderController,
  HeaderModule,
  MEDIA_PATH,
  MediaTypeController,
  MediaTypeModule,
  VERSION_HEADER,
};
