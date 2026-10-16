/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

import { bearerOf, subjectOf } from '#compat-test/jwt/read';
import type { NestRequest } from '@ailura/nestjs-hono-adapter';

import { BEARER, SUBJECT } from './constants.ts';
import type { Claims } from './strategy.ts';

@Controller()
class TokenController {
  private readonly jwt: JwtService;

  public constructor(jwt: JwtService) {
    this.jwt = jwt;
  }

  @Get('token')
  public async token(): Promise<{ readonly token: string }> {
    return {
      token: await this.jwt.signAsync({ sub: SUBJECT }),
    };
  }

  @Get('verify')
  public async verify(@Req() source: NestRequest): Promise<unknown> {
    const header = source.headers[BEARER];
    const token = bearerOf(header);
    return { subject: await this.subjectOf(token) };
  }

  private async subjectOf(token?: string): Promise<string | undefined> {
    if (token === undefined) return undefined;
    const verified = await this.jwt.verifyAsync<Claims>(token);
    return verified.sub;
  }
}

@Controller('guarded')
@UseGuards(AuthGuard('jwt'))
class GuardedController {
  @Get()
  public whoami(@Req() source: NestRequest): {
    readonly sub: string;
  } {
    return { sub: subjectOf(Reflect.get(source, 'user')) };
  }
}

export { GuardedController, TokenController };
