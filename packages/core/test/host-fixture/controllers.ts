import 'reflect-metadata';

import { Controller, Get, HostParam, Module } from '@nestjs/common';

const HOST = 'api.example.com';

const HOSTED_PATH = '/hosted';

const SUBDOMAIN_PATH = '/subdomain';

@Controller({ host: HOST })
class HostController {
  @Get('hosted')
  public hosted(): { host: boolean } {
    return { host: true };
  }
}

@Controller({ host: ':sub.example.com' })
class SubdomainController {
  @Get('subdomain')
  public subdomain(@HostParam('sub') sub: string): {
    sub: string;
  } {
    return { sub };
  }
}

@Module({
  controllers: [HostController, SubdomainController],
})
class HostModule {}

export { HOST, HOSTED_PATH, HostController, HostModule, SUBDOMAIN_PATH, SubdomainController };
