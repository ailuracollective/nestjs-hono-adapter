import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ConfigController, ENV_FILE } from '#compat-test/config-fixture/controllers';
import { APP_NAME_SCHEMA, requireAppName } from '#compat-test/config-fixture/validation';

const withValidate = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        envFilePath: ENV_FILE,
        validate: requireAppName,
      }),
    ],
  })
  class ValidatedModule {}
  return ValidatedModule;
};

const withRejectedConfig = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        validate: () => {
          throw new Error('the configuration was rejected');
        },
      }),
    ],
  })
  class RejectedModule {}
  return RejectedModule;
};

const withValidationSchema = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        envFilePath: ENV_FILE,
        validationSchema: APP_NAME_SCHEMA,
      }),
    ],
  })
  class SchemaValidatedModule {}
  return SchemaValidatedModule;
};

const withTransformingValidate = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        envFilePath: ENV_FILE,
        validate: (config: Record<string, unknown>) => ({
          APP_PORT: Number(config.APP_PORT),
        }),
      }),
    ],
  })
  class TransformedModule {}
  return TransformedModule;
};

export { withRejectedConfig, withTransformingValidate, withValidate, withValidationSchema };
