import 'reflect-metadata';

import {
  Controller,
  Get,
  HostParam,
  Module,
} from '@nestjs/common';

/** The host the fixed route answers. */
const HOST = 'api.example.com';

/** The path the fixed host route lives at. */
const HOSTED_PATH = '/hosted';

/** The path the parameterised host route lives at. */
const SUBDOMAIN_PATH = '/subdomain';

/** Answers only when the request host matches. */
@Controller({ host: HOST })
class HostController {
  /** Answers the request the host filter matched. */
  @Get('hosted')
  public hosted(): { host: boolean } {
    return { host: true };
  }
}

/** Reads the subdomain out of a parameterised host. */
@Controller({ host: ':sub.example.com' })
class SubdomainController {
  /** Answers with the subdomain the host carried. */
  @Get('subdomain')
  public subdomain(@HostParam('sub') sub: string): {
    sub: string;
  } {
    return { sub };
  }
}

/** The module declaring the host-routed controllers. */
@Module({
  controllers: [HostController, SubdomainController],
})
class HostModule {}

export {
  HOST,
  HOSTED_PATH,
  HostController,
  HostModule,
  SUBDOMAIN_PATH,
  SubdomainController,
};
