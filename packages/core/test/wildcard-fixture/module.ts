import 'reflect-metadata';

import { Module } from '@nestjs/common';

import type { ProbeOptions } from '#test/probe';

import {
  NamedController,
  PlainController,
  SiblingController,
  TailController,
} from './controllers.ts';

/** The module declaring the wildcard controllers. */
@Module({
  controllers: [
    PlainController,
    SiblingController,
    TailController,
    NamedController,
  ],
})
class WildcardModule {}

/** The probe that serves every one of those routes. */
const WILDCARD_PROBE: ProbeOptions = { module: WildcardModule };

export { WILDCARD_PROBE };
