/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

import { bearerOf, subjectOf } from '#adapter-test/jwt/read';
import type { NestRequest } from '#adapter/index';

import { BEARER, SUBJECT } from './constants.ts';
import type { Claims } from './strategy.ts';

/** Signs and verifies tokens for the fixture. */
@Controller()
class TokenController {
  /** The service that signs and verifies tokens. */
  private readonly jwt: JwtService;

  /** Stores the injected service. */
  public constructor(jwt: JwtService) {
    this.jwt = jwt;
  }

  /** Signs a token and answers with it. */
  @Get('token')
  public async token(): Promise<{ readonly token: string }> {
    return {
      token: await this.jwt.signAsync({ sub: SUBJECT }),
    };
  }

  /** Answers with the subject a sent token carries. */
  @Get('verify')
  public async verify(
    @Req() source: NestRequest,
  ): Promise<unknown> {
    const header = source.headers[BEARER];
    const token = bearerOf(header);
    return { subject: await this.subjectOf(token) };
  }

  /** The subject a verified token carries. */
  private async subjectOf(
    token?: string,
  ): Promise<string | undefined> {
    if (token === undefined) {
      return undefined;
    }
    const verified = await this.jwt.verifyAsync<Claims>(token);
    return verified.sub;
  }
}

/** A route under the package's own guard. */
@Controller('guarded')
@UseGuards(AuthGuard('jwt'))
class GuardedController {
  /** Answers with the subject the guard resolved. */
  @Get()
  public whoami(@Req() source: NestRequest): {
    readonly sub: string;
  } {
    return { sub: subjectOf(Reflect.get(source, 'user')) };
  }
}

export { GuardedController, TokenController };
