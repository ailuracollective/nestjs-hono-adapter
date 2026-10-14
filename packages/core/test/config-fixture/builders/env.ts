import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  ConfigController,
  ENV_FILE,
  EXPANDED_ENV_FILE,
} from '#adapter-test/config-fixture/controllers';

const withEnvFile = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [ConfigModule.forRoot({ envFilePath: ENV_FILE })],
  })
  class EnvFileModule {}
  return EnvFileModule;
};

/** The same application with expansion asked for. */
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

/** The same file read without expansion asked for. */
const withUnexpandedEnvFile = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({ envFilePath: EXPANDED_ENV_FILE }),
    ],
  })
  class UnexpandedEnvFileModule {}
  return UnexpandedEnvFileModule;
};

export {
  withEnvFile,
  withExpandedEnvFile,
  withUnexpandedEnvFile,
};
