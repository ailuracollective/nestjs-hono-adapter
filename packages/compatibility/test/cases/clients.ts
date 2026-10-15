import { Body, Controller, Get, Module, Post, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { HttpClientModule } from '@nestjs/http-client';
import { PartialType } from '@nestjs/mapped-types';
import { IsString } from 'class-validator';

import type { CompatibilityCase } from './types.ts';

@Controller()
class AxiosController {
  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [AxiosController], imports: [HttpModule] })
class AxiosFixture {}

@Controller()
class HttpClientController {
  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [HttpClientController], imports: [HttpClientModule.register()] })
class HttpClientFixture {}

class CreateThing {
  @IsString()
  public name!: string;
}

class UpdateThing extends PartialType(CreateThing) {}

@Controller()
class MappedTypesController {
  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: true };
  }

  @Post('things')
  public update(@Body() body: UpdateThing): { name: string | undefined } {
    return { name: body.name };
  }
}

@Module({
  controllers: [MappedTypesController],
  providers: [{ provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) }],
})
class MappedTypesFixture {}

const CLIENT_CASES: readonly CompatibilityCase[] = [
  { module: AxiosFixture, name: '@nestjs/axios' },
  { module: HttpClientFixture, name: '@nestjs/http-client' },
  { module: MappedTypesFixture, name: '@nestjs/mapped-types' },
];

export { CLIENT_CASES, MappedTypesFixture };
