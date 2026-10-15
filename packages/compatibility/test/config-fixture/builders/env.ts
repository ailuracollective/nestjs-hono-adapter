import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  ConfigController,
  ENV_FILE,
  EXPANDED_ENV_FILE,
} from '#compat-test/config-fixture/controllers';

const withEnvFile = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [ConfigModule.forRoot({ envFilePath: ENV_FILE })],
  })
  class EnvFileModule {}
  return EnvFileModule;
};

const withExpandedEnvFile = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        envFilePath: EXPANDED_ENV_FILE,
        expandVariables: true,
      }),
    ],
  })
  class ExpandedEnvFileModule {}
  return ExpandedEnvFileModule;
};

const withUnexpandedEnvFile = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [ConfigModule.forRoot({ envFilePath: EXPANDED_ENV_FILE })],
  })
  class UnexpandedEnvFileModule {}
  return UnexpandedEnvFileModule;
};

export { withEnvFile, withExpandedEnvFile, withUnexpandedEnvFile };
