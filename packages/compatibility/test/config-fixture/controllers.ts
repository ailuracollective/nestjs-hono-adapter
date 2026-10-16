import { fileURLToPath } from 'node:url';

import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ConfigService, registerAs } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';

const ENV_FILE = fileURLToPath(new URL('../fixtures/config/app.env', import.meta.url));

const EXPANDED_ENV_FILE = fileURLToPath(
  new URL('../fixtures/config/app.expanded.env', import.meta.url),
);

const databaseConfig = registerAs('database', () => ({
  host: 'db.internal',
  port: 5432,
}));

type Database = ConfigType<typeof databaseConfig>;

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

@Controller('slice')
class SliceController {
  private readonly database: Database;

  public constructor(@Inject(databaseConfig.KEY) database: Database) {
    this.database = database;
  }

  @Get('database')
  public databaseSlice(): unknown {
    return this.database;
  }
}

export { ConfigController, ENV_FILE, EXPANDED_ENV_FILE, SliceController, databaseConfig };
export type { Database };
