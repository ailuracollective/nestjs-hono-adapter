import 'reflect-metadata';

import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Redirect,
} from '@nestjs/common';

/** The routes that answer a declared status, header or redirect. */
@Controller('response')
class StatusController {
  /** Answers with a decorated status and header. */
  @Get('decorated')
  @Header('x-decorated', 'yes')
  @HttpCode(HttpStatus.ACCEPTED)
  public decorated(): unknown {
    return { decorated: true };
  }

  /** Answers with a redirect. */
  @Get('redirect')
  @Redirect(
    'https://example.com/',
    HttpStatus.MOVED_PERMANENTLY,
  )
  public redirect(): unknown {
    return {};
  }

  /** Answers a status that forbids a body. */
  @Get('no-content')
  @HttpCode(HttpStatus.NO_CONTENT)
  public noContent(): unknown {
    return { discarded: true };
  }

  /** Answers a null-body status for a string. */
  @Get('no-content-text')
  @HttpCode(HttpStatus.NO_CONTENT)
  public noContentText(): string {
    return 'discarded';
  }

  /** Answers a reset status. */
  @Get('reset-content')
  @HttpCode(HttpStatus.RESET_CONTENT)
  public resetContent(): unknown {
    return { reset: true };
  }

  /** Answers a not-modified status. */
  @Get('not-modified')
  @HttpCode(HttpStatus.NOT_MODIFIED)
  public notModified(): unknown {
    return { cached: true };
  }
}

export { StatusController };
