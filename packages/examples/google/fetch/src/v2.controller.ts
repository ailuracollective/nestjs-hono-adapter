import { Controller, Get, Version } from '@nestjs/common';

/** The version-2 example controller. */
@Controller()
export class V2Controller {
  /** Answers the version-2 greeting. */
  @Get('hello')
  @Version('2')
  public hello(): { from: string } {
    return { from: 'v2' };
  }
}
