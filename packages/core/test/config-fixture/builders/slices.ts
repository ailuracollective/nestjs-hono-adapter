import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  ConfigController,
  SliceController,
  databaseConfig,
} from '#adapter-test/config-fixture/controllers';

/** An application that registers a slice by hand. */
const withRegisteredSlice = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController, SliceController],
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [databaseConfig],
      }),
      ConfigModule.forFeature(databaseConfig),
    ],
  })
  class RegisteredSliceModule {}
  return RegisteredSliceModule;
};

/** The same application with the configuration cached. */
const withCache = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        cache: true,
        ignoreEnvFile: true,
      }),
      ConfigModule.forFeature(databaseConfig),
    ],
  })
  class CachedModule {}
  return CachedModule;
};

/** An application told to ignore the process environment. */
const withSkipProcessEnv = (): Type<unknown> => {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        skipProcessEnv: true,
      }),
    ],
  })
  class SkipProcessEnvModule {}
  return SkipProcessEnvModule;
};

export { withCache, withRegisteredSlice, withSkipProcessEnv };
