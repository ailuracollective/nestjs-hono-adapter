/**
 * The fixture the configuration cases build against: the
 * application modules that register `@nestjs/config` the ways
 * an application can, and the routes that read the loaded
 * configuration back out over HTTP.
 *
 * `@nestjs/config` builds a configuration object in three
 * stages — `forRoot` loads it, `registerAs` names a slice of
 * it, and `forFeature` exposes that slice to the module that
 * asks for it — so a case covers one stage rather than all
 * three at once. What is left to the adapter is the same in
 * every one: the loaded value has to survive the trip out of
 * the container, through a route handler, and back as an
 * answer.
 *
 * Every application is built by a function rather than declared
 * as a constant, which is the shape the official suite uses and
 * the one that has to be here: `forRoot` loads the environment
 * the moment it is called, so a module declared at import time
 * would have loaded it before any case had a chance to set up
 * the environment it is meant to be reading. A function defers
 * that moment to the case asking for the application.
 *
 * The environment files are named one per shape rather than
 * shared, because `forRoot` writes what it loads into
 * `process.env`: two cases sharing a name would each read
 * whichever loaded last, and the case for expansion would be
 * answering for the case for plain loading.
 *
 * The modules live in their own file, as
 * `./middleware-fixture.ts` and `./versioning-fixture.ts` do,
 * because what they are about is how an application registers
 * configuration rather than what the bridge translates.
 */

import 'reflect-metadata';

import {
  Controller,
  Get,
  Inject,
  Module,
  Param,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
  registerAs,
} from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';

import { fileURLToPath } from 'node:url';

import type { ProbeOptions } from './probe.ts';

/** The file whose variables are read as they are written. */
const ENV_FILE = fileURLToPath(
  new URL('fixtures/config/app.env', import.meta.url),
);

/**
 * The file whose greeting is written in terms of another
 * variable.
 */
const EXPANDED_ENV_FILE = fileURLToPath(
  new URL('fixtures/config/app.expanded.env', import.meta.url),
);

/**
 * The slice of configuration the cases register by hand, named
 * the way an application names one: a `registerAs` factory,
 * which hands the object it produces a token keyed by its own
 * name.
 *
 * `registerAs` rather than a bare object is not a matter of
 * taste: `forFeature` builds a provider whose factory is
 * whatever it is given, so an object where a function belongs
 * is instantiated as a class, and Nest fails on a metatype it
 * cannot call.
 */
const databaseConfig = registerAs('database', () => ({
  host: 'db.internal',
  port: 5432,
}));

/** The shape the registered slice reaches a constructor as. */
type Database = ConfigType<typeof databaseConfig>;

/**
 * Reads the loaded configuration and answers with one key of
 * it, which is the shape a case reads a variable the module
 * loaded for itself.
 */
@Controller('config')
class ConfigController {
  private readonly config: ConfigService;

  public constructor(config: ConfigService) {
    this.config = config;
  }

  @Get('env/:key')
  public environment(@Param('key') key: string): unknown {
    return this.config.get(key);
  }
}

/**
 * Answers with a registered slice injected under the token
 * `forFeature` registers, which is a separate controller
 * because that token only exists in the applications that asked
 * for it: a controller that asked for it everywhere would stop
 * the others from starting.
 */
@Controller('slice')
class SliceController {
  private readonly database: Database;

  public constructor(
    @Inject(databaseConfig.KEY) database: Database,
  ) {
    this.database = database;
  }

  @Get('database')
  public databaseSlice(): unknown {
    return this.database;
  }
}

/**
 * An application that reads its environment from the file named
 * above and nothing else. This is the shape `forRoot` is for:
 * the variables the process already holds are left alone, and
 * the file fills in what they did not say.
 */
function withEnvFile(): Type<unknown> {
  @Module({
    controllers: [ConfigController],
    imports: [ConfigModule.forRoot({ envFilePath: ENV_FILE })],
  })
  class EnvFileModule {}
  return EnvFileModule;
}

/**
 * The same application with expansion asked for, which is what
 * turns the `${APP_NAME}` in the greeting into its value.
 */
function withExpandedEnvFile(): Type<unknown> {
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
}

/**
 * The same file read by an application that is not asked to
 * expand, which is what makes the two tell each other apart:
 * the reference is still there to be read.
 */
function withUnexpandedEnvFile(): Type<unknown> {
  @Module({
    controllers: [ConfigController],
    imports: [
      ConfigModule.forRoot({ envFilePath: EXPANDED_ENV_FILE }),
    ],
  })
  class UnexpandedEnvFileModule {}
  return UnexpandedEnvFileModule;
}

/**
 * An application that registers a slice by hand and exposes it
 * to the module asking for it. The two calls sit in one module
 * because `forFeature` extends what `forRoot` loaded rather
 * than loading anything itself, which is the composition the
 * official suite uses and the only one that resolves.
 */
function withRegisteredSlice(): Type<unknown> {
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
}

/**
 * The same application with the loaded configuration cached,
 * which is what stops a `get` from re-reading the environment
 * on every call. A case tells the two apart by changing a
 * variable after the application has started.
 */
function withCache(): Type<unknown> {
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
}

/**
 * An application told to ignore the variables the process
 * already holds, which is what a case sets a variable before
 * starting one to show it is not what answers.
 */
function withSkipProcessEnv(): Type<unknown> {
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
}

/**
 * Rejects a configuration that did not load what the
 * application needs, named here rather than written inline so
 * the module that uses it reads as the case that is about it.
 */
function requireAppName(config: Record<string, unknown>): {
  APP_NAME: unknown;
} {
  if (typeof config.APP_NAME !== 'string') {
    throw new TypeError('APP_NAME was not loaded');
  }
  return { APP_NAME: config.APP_NAME };
}

/** An application whose configuration has to pass a function. */
function withValidate(): Type<unknown> {
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
}

/**
 * An application whose configuration has to pass this, which is
 * the shape a case uses to show a rejected configuration stops
 * the application rather than being answered with.
 */
function withRejectedConfig(): Type<unknown> {
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
}

/**
 * The name out of a loaded configuration, or `undefined` when
 * what arrived is not the shape the schema expects. The module
 * hands the schema an `unknown`, so this is where the shape is
 * narrowed.
 */
function nameOf(config: unknown): string | undefined {
  if (typeof config !== 'object' || config === null) {
    return undefined;
  }
  const name: unknown = Reflect.get(config, 'APP_NAME');
  if (typeof name !== 'string') {
    return undefined;
  }
  return name;
}

/**
 * A schema reporting a missing name as a validation issue,
 * written against the Standard Schema interface rather than
 * pulled in from a validation library: the shape is two fields
 * and a function, and a dependency would be a heavier way to
 * say it than this repository's fixtures are allowed to be.
 */
const APP_NAME_SCHEMA = {
  '~standard': {
    validate: (
      config: unknown,
    ):
      | { value: unknown }
      | { issues: readonly { message: string }[] } => {
      const name = nameOf(config);
      if (name === undefined) {
        return {
          issues: [{ message: 'APP_NAME was not loaded' }],
        };
      }
      return { value: { APP_NAME: name } };
    },
    vendor: 'nestjs-hono-adapter',
    version: 1 as const,
  },
};

/**
 * An application that validates through a schema instead. A
 * schema keeps only what it declares, so the port the file also
 * carries is the proof that the module merges the rest back in
 * rather than losing it.
 */
function withValidationSchema(): Type<unknown> {
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
}

/** An application that transforms what it loaded. */
function withTransformingValidate(): Type<unknown> {
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
}

/**
 * The probe options for an application, on whichever path a
 * case asks for.
 */
function configured(
  module: Type<unknown>,
  mode: ProbeOptions['mode'] = 'in-process',
): ProbeOptions {
  return { mode, module };
}

export {
  APP_NAME_SCHEMA,
  ENV_FILE,
  EXPANDED_ENV_FILE,
  configured,
  databaseConfig,
  requireAppName,
  withCache,
  withEnvFile,
  withExpandedEnvFile,
  withRejectedConfig,
  withRegisteredSlice,
  withSkipProcessEnv,
  withTransformingValidate,
  withUnexpandedEnvFile,
  withValidate,
  withValidationSchema,
};
export type { Database };
