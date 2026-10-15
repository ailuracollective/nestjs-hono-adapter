import { Controller, Get, Module } from '@nestjs/common';
import {
  InjectModel as InjectMongooseModel,
  MongooseModule,
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { InjectModel as InjectSequelizeModel, SequelizeModule } from '@nestjs/sequelize';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  Column as SequelizeColumn,
  DataType,
  Model as SequelizeModel,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import type { Model } from 'mongoose';
import type { Repository } from 'typeorm';

import type { CompatibilityCase } from './types.ts';

const OPEN_READ_WRITE = 2;

const OPEN_CREATE = 4;

const SERVER_SELECTION_TIMEOUT_MS = 200;

@Entity()
class Cat {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;
}

@Controller()
class TypeOrmController {
  private readonly cats: Repository<Cat>;

  public constructor(@InjectRepository(Cat) cats: Repository<Cat>) {
    this.cats = cats;
  }

  @Get('ping')
  public async ping(): Promise<{ ok: boolean }> {
    return { ok: (await this.cats.count()) === 0 };
  }
}

@Module({
  controllers: [TypeOrmController],
  imports: [
    TypeOrmModule.forRoot({
      autoSave: false,
      entities: [Cat],
      synchronize: true,
      type: 'sqljs',
    }),
    TypeOrmModule.forFeature([Cat]),
  ],
})
class TypeOrmFixture {}

@Schema()
class CatDocument {
  @Prop()
  public name!: string;
}

const CatSchema = SchemaFactory.createForClass(CatDocument);

@Controller()
class MongooseController {
  private readonly cats: Model<CatDocument>;

  public constructor(@InjectMongooseModel(CatDocument.name) cats: Model<CatDocument>) {
    this.cats = cats;
  }

  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: this.cats.modelName === CatDocument.name };
  }
}

@Module({
  controllers: [MongooseController],
  imports: [
    // `lazyConnection` keeps the module from awaiting a server, and the short server-selection
    // timeout is what lets the connection give up (and `close()` return) when none is there.
    MongooseModule.forRoot('mongodb://127.0.0.1:1/inert', {
      connectTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      lazyConnection: true,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    }),
    MongooseModule.forFeature([{ name: CatDocument.name, schema: CatSchema }]),
  ],
})
class MongooseFixture {}

@Table
class SqlCat extends SequelizeModel {
  @PrimaryKey
  @SequelizeColumn(DataType.INTEGER)
  declare public id: number;

  @SequelizeColumn(DataType.STRING)
  declare public name: string;
}

@Controller()
class SequelizeController {
  private readonly cats: typeof SqlCat;

  public constructor(@InjectSequelizeModel(SqlCat) cats: typeof SqlCat) {
    this.cats = cats;
  }

  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: this.cats.name === 'SqlCat' };
  }
}

@Module({
  controllers: [SequelizeController],
  imports: [
    // No SQLite driver ships for Bun, so the module resolves its models without dialling a
    // database: the connection is the package's own and never the adapter's. See the README.
    SequelizeModule.forRoot({
      autoLoadModels: false,
      dialect: 'sqlite',
      dialectModule: { OPEN_CREATE, OPEN_READ_WRITE },
      models: [SqlCat],
      storage: ':memory:',
    }),
    SequelizeModule.forFeature([SqlCat]),
  ],
})
class SequelizeFixture {}

const PERSISTENCE_CASES: readonly CompatibilityCase[] = [
  { module: TypeOrmFixture, name: '@nestjs/typeorm' },
  { module: MongooseFixture, name: '@nestjs/mongoose' },
  { module: SequelizeFixture, name: '@nestjs/sequelize' },
];

export { PERSISTENCE_CASES };
