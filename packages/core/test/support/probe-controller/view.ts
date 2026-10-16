import { Controller, Get, HttpCode, HttpStatus, Module, Post, Render } from '@nestjs/common';

import { BodyController } from './body.ts';
import { ProbeController } from './probe.ts';

@Controller('view')
class ViewController {
  @Get()
  @Render('hello')
  public hello(): unknown {
    return { name: 'Nest' };
  }

  @Post('created')
  @Render('hello')
  public created(): unknown {
    return { name: 'Nest' };
  }

  @Get('missing')
  @Render('missing')
  public missing(): unknown {
    return {};
  }

  @Get('accepted')
  @HttpCode(HttpStatus.ACCEPTED)
  @Render('hello')
  public accepted(): unknown {
    return { name: 'Nest' };
  }
}

@Module({
  controllers: [ProbeController, BodyController, ViewController],
})
class ProbeModule {}

export { ProbeModule };
