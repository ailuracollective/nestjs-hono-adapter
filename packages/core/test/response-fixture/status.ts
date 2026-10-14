import 'reflect-metadata';

import { Controller, Get, Header, HttpCode, HttpStatus, Redirect } from '@nestjs/common';

@Controller('response')
class StatusController {
  @Get('decorated')
  @Header('x-decorated', 'yes')
  @HttpCode(HttpStatus.ACCEPTED)
  public decorated(): unknown {
    return { decorated: true };
  }

  @Get('redirect')
  @Redirect('https://example.com/', HttpStatus.MOVED_PERMANENTLY)
  public redirect(): unknown {
    return {};
  }

  @Get('no-content')
  @HttpCode(HttpStatus.NO_CONTENT)
  public noContent(): unknown {
    return { discarded: true };
  }

  @Get('no-content-text')
  @HttpCode(HttpStatus.NO_CONTENT)
  public noContentText(): string {
    return 'discarded';
  }

  @Get('reset-content')
  @HttpCode(HttpStatus.RESET_CONTENT)
  public resetContent(): unknown {
    return { reset: true };
  }

  @Get('not-modified')
  @HttpCode(HttpStatus.NOT_MODIFIED)
  public notModified(): unknown {
    return { cached: true };
  }
}

export { StatusController };
