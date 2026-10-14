import 'reflect-metadata';

import { Controller, Get, Module, VERSION_NEUTRAL, Version } from '@nestjs/common';

const MEDIA_PATH = '/media';

const HEADER_PATH = '/header';

const VERSION_HEADER = 'x-api-version';

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

  @Get()
  @Version(VERSION_NEUTRAL)
  public neutral(): unknown {
    return { served: 'neutral' };
  }

  @Get('list')
  @Version([VERSION_NEUTRAL, '1'])
  public neutralOrFirst(): unknown {
    return { served: 'neutral-or-1' };
  }
}

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

export {
  HEADER_PATH,
  HeaderController,
  HeaderModule,
  MEDIA_PATH,
  MediaTypeController,
  MediaTypeModule,
  VERSION_HEADER,
};
