import 'reflect-metadata';

import { Module } from '@nestjs/common';

import type { ProbeOptions } from '#test/probe';

import {
  NamedController,
  PlainController,
  SiblingController,
  TailController,
} from './controllers.ts';

@Module({
  controllers: [PlainController, SiblingController, TailController, NamedController],
})
class WildcardModule {}

const WILDCARD_PROBE: ProbeOptions = { module: WildcardModule };

export { WILDCARD_PROBE };
