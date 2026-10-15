import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CqrsController } from './controller.ts';
import { DoubleQueryHandler, GreetCommandHandler, GreetedListener } from './handlers.ts';

@Module({
  controllers: [CqrsController],
  imports: [CqrsModule.forRoot()],
  providers: [GreetCommandHandler, DoubleQueryHandler, GreetedListener],
})
class CqrsModuleFixture {}

export { CqrsModuleFixture };
