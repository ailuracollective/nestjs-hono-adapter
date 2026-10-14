import 'reflect-metadata';

import {
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Req,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import type { NestRequest } from '#adapter/index';

/** How many request-scoped providers have been built. */
let resolutions = 0;

/** What one answer carries back. */
interface Seen {
  readonly same: boolean;
  readonly serial: number;
  readonly url: string;
}

/** A provider built once per request, holding its request. */
@Injectable({ scope: Scope.REQUEST })
class ScopedReader {
  /** The request Nest resolved for this provider. */
  private readonly source: NestRequest;

  /** Which resolution of this provider this is. */
  public readonly serial: number;

  /** Stores the request and numbers the resolution. */
  public constructor(@Inject(REQUEST) source: NestRequest) {
    this.source = source;
    resolutions += 1;
    this.serial = resolutions;
  }

  /** Whether the injected request is the route's own. */
  public isSameAs(other: NestRequest): boolean {
    return this.source === other;
  }

  /** The URL of the request this provider was built for. */
  public urlOf(): string {
    return this.source.url;
  }
}

/** The controller answering what the scoped provider saw. */
@Controller()
class ContextController {
  /** The request-scoped provider the route reads. */
  private readonly scoped: ScopedReader;

  public constructor(scoped: ScopedReader) {
    this.scoped = scoped;
  }

  /** Answers what the scoped provider saw. */
  @Get('seen')
  public seen(@Req() source: NestRequest): Seen {
    return {
      same: this.scoped.isSameAs(source),
      serial: this.scoped.serial,
      url: this.scoped.urlOf(),
    };
  }
}

/** The module declaring the context controller. */
@Module({
  controllers: [ContextController],
  providers: [ScopedReader],
})
class ContextModule {}

/** Forgets what a previous case resolved. */
const resetResolutions = (): void => {
  resolutions = 0;
};

export { ContextModule, resetResolutions };
export type { Seen };
