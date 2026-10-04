/**
 * The fixture the wildcard cases build against: the modules
 * whose routes carry a wildcard, and the probe that serves
 * them. The probe that builds them lives in `probe.ts`.
 *
 * Every controller has a prefix of its own, because Hono
 * answers a request with the first route it matches, so a
 * trailing wildcard would otherwise swallow the siblings
 * registered under the same prefix.
 */
import 'reflect-metadata';

import { Controller, Get, Module, Param } from '@nestjs/common';

import type { ProbeOptions } from './probe.ts';

/** The prefix the routes with no wildcard in them are on. */
const FILES_PATH = '/files';

/** The prefix the route whose wildcard ends the path is on. */
const TREE_PATH = '/tree';

/**
 * The prefix the route whose wildcard has a sibling after it is
 * on.
 */
const DIRS_PATH = '/dirs';

/** The prefix the route with a name beside a wildcard is on. */
const USERS_PATH = '/users';

/**
 * What a handler that reads the wildcard under one key saw. The
 * three keys are every spelling `@Param()` could be asked to
 * read a wildcard by, so a case can say which one resolves
 * rather than which one was expected to.
 */
interface ReadSpelling {
  readonly byName: string | undefined;
  readonly byNumber: string | undefined;
  readonly byStar: string | undefined;
}

/**
 * The route whose wildcard takes the rest of the path, which is
 * what a handler serving a tree of files is declared with.
 */
@Controller(TREE_PATH)
class TailController {
  @Get('*')
  public tail(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }
}

/**
 * The route whose wildcard has a sibling after it, so the
 * wildcard has to stop where that sibling begins.
 */
@Controller(DIRS_PATH)
class SiblingController {
  @Get('*/meta')
  public meta(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }
}

/**
 * The route with a named parameter beside a wildcard, because
 * both are answered by one request and reading one must not
 * cost the other.
 */
@Controller(USERS_PATH)
class NamedController {
  @Get(':id/*rest')
  public files(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }
}

/**
 * The route with no wildcard in it at all, beside the one that
 * reads the wildcard under each of the keys a handler might
 * name it by.
 */
@Controller(FILES_PATH)
class PlainController {
  @Get('plain')
  public plain(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }

  @Get('spellings/*')
  public spellings(
    @Param('rest') byName: string | undefined,
    @Param('0') byNumber: string | undefined,
    @Param('*') byStar: string | undefined,
  ): ReadSpelling {
    return { byName, byNumber, byStar };
  }
}

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

export {
  DIRS_PATH,
  FILES_PATH,
  TREE_PATH,
  USERS_PATH,
  WILDCARD_PROBE,
};
export type { ReadSpelling };
