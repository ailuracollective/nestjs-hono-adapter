import 'reflect-metadata';

import { Controller, Get, Param } from '@nestjs/common';

/** The prefix the routes with no wildcard in them are on. */
const FILES_PATH = '/files';

/** The prefix the route whose wildcard ends the path is on. */
const TREE_PATH = '/tree';

/** The prefix the wildcard-with-sibling route is on. */
const DIRS_PATH = '/dirs';

/** The prefix the route with a name beside a wildcard is on. */
const USERS_PATH = '/users';

/** What a handler reading the wildcard under one key saw. */
interface ReadSpelling {
  readonly byName: string | undefined;
  readonly byNumber: string | undefined;
  readonly byStar: string | undefined;
}

/** The route whose wildcard takes the rest of the path. */
@Controller(TREE_PATH)
class TailController {
  /** Answers with the captured parameters. */
  @Get('*')
  public tail(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }
}

/** The route whose wildcard stops where a sibling begins. */
@Controller(DIRS_PATH)
class SiblingController {
  /** Answers with the captured parameters. */
  @Get('*/meta')
  public meta(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }
}

/** The route with a named parameter beside a wildcard. */
@Controller(USERS_PATH)
class NamedController {
  /** Answers with the captured parameters. */
  @Get(':id/*rest')
  public files(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }
}

/** The route with no wildcard and the spellings route. */
@Controller(FILES_PATH)
class PlainController {
  /** Answers with the captured parameters. */
  @Get('plain')
  public plain(
    @Param() params: Record<string, string>,
  ): unknown {
    return { params };
  }

  /** Answers with the wildcard read under each key. */
  @Get('spellings/*')
  public spellings(
    @Param('rest') byName: string | undefined,
    @Param('0') byNumber: string | undefined,
    @Param('*') byStar: string | undefined,
  ): ReadSpelling {
    return { byName, byNumber, byStar };
  }
}

export {
  DIRS_PATH,
  FILES_PATH,
  NamedController,
  PlainController,
  SiblingController,
  TREE_PATH,
  TailController,
  USERS_PATH,
};
export type { ReadSpelling };
