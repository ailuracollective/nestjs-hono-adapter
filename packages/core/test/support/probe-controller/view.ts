import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Post,
  Render,
} from '@nestjs/common';

import { BodyController } from './body.ts';
import { ProbeController } from './probe.ts';

/** A controller that answers with a rendered template. */
@Controller('view')
class ViewController {
  /** Answers with the rendered hello template. */
  @Get()
  @Render('hello')
  public hello(): unknown {
    return { name: 'Nest' };
  }

  @Post('created')
  /** Answers a POST with the rendered hello template. */
  @Render('hello')
  public created(): unknown {
    return { name: 'Nest' };
  }

  @Get('missing')
  /** Answers with a template that does not exist. */
  @Render('missing')
  public missing(): unknown {
    return {};
  }

  @Get('accepted')
  @HttpCode(HttpStatus.ACCEPTED)
  /** Answers with the accepted status and the template. */
  @Render('hello')
  public accepted(): unknown {
    return { name: 'Nest' };
  }
}

/** The module declaring the probe and view controllers. */
@Module({
  controllers: [
    ProbeController,
    BodyController,
    ViewController,
  ],
})
class ProbeModule {}

export { ProbeModule };
