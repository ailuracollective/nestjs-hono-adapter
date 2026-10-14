import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  ConfigController,
  ENV_FILE,
} from '#adapter-test/config-fixture/controllers';
import {
  APP_NAME_SCHEMA,
  requireAppName,
} from '#adapter-test/config-fixture/validation';

/** An application whose configuration passes a function. */
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

/** An application whose configuration is rejected. */
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

/** An application that validates through a schema. */
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

/** An application that transforms what it loaded. */
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

export {
  withRejectedConfig,
  withTransformingValidate,
  withValidate,
  withValidationSchema,
};
