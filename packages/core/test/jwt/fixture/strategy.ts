import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { SECRET } from './constants.ts';

interface Claims {
  readonly sub: string;
}

@Injectable()
class TokenStrategy extends PassportStrategy(Strategy) {
  public constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: SECRET,
    });
  }

  public validate(claims: Claims): Claims {
    return claims;
  }
}

export { TokenStrategy };
export type { Claims };
