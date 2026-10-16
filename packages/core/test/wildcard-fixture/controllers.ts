import 'reflect-metadata';

import { Controller, Get, Param } from '@nestjs/common';

const FILES_PATH = '/files';

const TREE_PATH = '/tree';

const DIRS_PATH = '/dirs';

const USERS_PATH = '/users';

interface ReadSpelling {
  readonly byName: string | undefined;
  readonly byNumber: string | undefined;
  readonly byStar: string | undefined;
}

@Controller(TREE_PATH)
class TailController {
  @Get('*')
  public tail(@Param() params: Record<string, string>): unknown {
    return { params };
  }
}

@Controller(DIRS_PATH)
class SiblingController {
  @Get('*/meta')
  public meta(@Param() params: Record<string, string>): unknown {
    return { params };
  }
}

@Controller(USERS_PATH)
class NamedController {
  @Get(':id/*rest')
  public files(@Param() params: Record<string, string>): unknown {
    return { params };
  }
}

@Controller(FILES_PATH)
class PlainController {
  @Get('plain')
  public plain(@Param() params: Record<string, string>): unknown {
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
