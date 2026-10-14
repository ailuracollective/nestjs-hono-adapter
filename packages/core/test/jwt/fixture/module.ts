import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { SECRET } from './constants.ts';
import {
  GuardedController,
  TokenController,
} from './controllers.ts';
import { TokenStrategy } from './strategy.ts';

/** The module that wires the token fixture. */
@Module({
  controllers: [TokenController, GuardedController],
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: SECRET,
      signOptions: { expiresIn: '10m' },
    }),
  ],
  providers: [TokenStrategy],
})
class TokenModule {}

export { TokenModule };
