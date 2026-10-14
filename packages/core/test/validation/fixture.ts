import 'reflect-metadata';

import { Body, Controller, Module, Post } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';

/** The body a validated route accepts. */
class CreatePerson {
  /** The name the body must carry. */
  @IsString()
  public name!: string;

  /** The age the body must carry, one or more. */
  @IsInt()
  @Min(1)
  public age!: number;
}

/** Answers the body a validation pipe let through. */
@Controller()
class ValidationController {
  /** Answers the validated body. */
  @Post('validated')
  public validated(@Body() body: CreatePerson): CreatePerson {
    return body;
  }
}

/** The module declaring the validated controller. */
@Module({ controllers: [ValidationController] })
class ValidationModule {}

export { CreatePerson, ValidationController, ValidationModule };
