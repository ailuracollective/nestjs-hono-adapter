import { fileURLToPath } from 'node:url';

import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ConfigService, registerAs } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';

/** The file whose variables are read as written. */
const ENV_FILE = fileURLToPath(
  new URL('../fixtures/config/app.env', import.meta.url),
);

/** The file whose greeting names another variable. */
const EXPANDED_ENV_FILE = fileURLToPath(
  new URL(
    '../fixtures/config/app.expanded.env',
    import.meta.url,
  ),
);

/** The configuration slice the cases register by hand. */
const databaseConfig = registerAs('database', () => ({
  host: 'db.internal',
  port: 5432,
}));

/** The shape the registered slice reaches a constructor as. */
type Database = ConfigType<typeof databaseConfig>;

/** Reads the loaded configuration and answers with one key. */
@Controller('config')
class ConfigController {
  /** The configuration service the route reads. */
  private readonly config: ConfigService;

  /** Stores the injected configuration service. */
  public constructor(config: ConfigService) {
    this.config = config;
  }

  /** Answers with one key of the loaded configuration. */
  @Get('env/:key')
  public environment(@Param('key') key: string): unknown {
    return this.config.get(key);
  }
}

/** Answers with the slice the application injected. */
@Controller('slice')
class SliceController {
  /** The registered slice the route answers with. */
  private readonly database: Database;

  /** Stores the injected slice. */
  public constructor(
    @Inject(databaseConfig.KEY) database: Database,
  ) {
    this.database = database;
  }

  /** Answers with the registered slice. */
  @Get('database')
  public databaseSlice(): unknown {
    return this.database;
  }
}

/** An application that reads its environment from a file. */

export {
  ConfigController,
  ENV_FILE,
  EXPANDED_ENV_FILE,
  SliceController,
  databaseConfig,
};
export type { Database };
