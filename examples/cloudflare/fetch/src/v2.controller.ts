import { Controller, Get, Version } from '@nestjs/common';

@Controller()
export class V2Controller {
  @Get('hello')
  @Version('2')
  public hello(): { from: string } {
    return { from: 'v2' };
  }
}
