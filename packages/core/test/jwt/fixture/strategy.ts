import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { SECRET } from './constants.ts';

/** The claims the strategy accepts. */
interface Claims {
  readonly sub: string;
}

/** The strategy the guard resolves. */
@Injectable()
class TokenStrategy extends PassportStrategy(Strategy) {
  /** Configures the strategy with the fixture secret. */
  public constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: SECRET,
    });
  }

  /** Answers with the claims it was given. */
  public validate(claims: Claims): Claims {
    return claims;
  }
}

export { TokenStrategy };
export type { Claims };
