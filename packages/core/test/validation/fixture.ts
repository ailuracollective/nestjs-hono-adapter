import 'reflect-metadata';

import { Body, Controller, Module, Post } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';

class CreatePerson {
  @IsString()
  public name!: string;

  @IsInt()
  @Min(1)
  public age!: number;
}

@Controller()
class ValidationController {
  @Post('validated')
  public validated(@Body() body: CreatePerson): CreatePerson {
    return body;
  }
}

@Module({ controllers: [ValidationController] })
class ValidationModule {}

export { CreatePerson, ValidationController, ValidationModule };
