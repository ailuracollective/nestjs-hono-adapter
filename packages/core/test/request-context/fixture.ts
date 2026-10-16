import 'reflect-metadata';

import { Controller, Get, Inject, Injectable, Module, Req, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import type { NestRequest } from '#adapter/index';

let resolutions = 0;

interface Seen {
  readonly same: boolean;
  readonly serial: number;
  readonly url: string;
}

@Injectable({ scope: Scope.REQUEST })
class ScopedReader {
  private readonly source: NestRequest;

  public readonly serial: number;

  public constructor(@Inject(REQUEST) source: NestRequest) {
    this.source = source;
    resolutions += 1;
    this.serial = resolutions;
  }

  public isSameAs(other: NestRequest): boolean {
    return this.source === other;
  }

  public urlOf(): string {
    return this.source.url;
  }
}

@Controller()
class ContextController {
  private readonly scoped: ScopedReader;

  public constructor(scoped: ScopedReader) {
    this.scoped = scoped;
  }

  @Get('seen')
  public seen(@Req() source: NestRequest): Seen {
    return {
      same: this.scoped.isSameAs(source),
      serial: this.scoped.serial,
      url: this.scoped.urlOf(),
    };
  }
}

@Module({
  controllers: [ContextController],
  providers: [ScopedReader],
})
class ContextModule {}

const resetResolutions = (): void => {
  resolutions = 0;
};

export { ContextModule, resetResolutions };
export type { Seen };
