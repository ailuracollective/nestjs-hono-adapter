import 'reflect-metadata';

import {
  Controller,
  Get,
  Inject,
  Module,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  CACHE_MANAGER,
  CacheInterceptor,
  CacheModule,
  CacheTTL,
} from '@nestjs/cache-manager';

import { TTL } from './cache.ts';
import type { Cache } from './cache.ts';

/** How many answers the counted routes have served. */
let calls = 0;

/** A controller whose answers the cache interceptor keeps. */
@Controller()
class CachedController {
  /** The cache the routes read and write. */
  private readonly cache: Cache;

  /** Stores the injected cache manager. */
  public constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    this.cache = cache;
  }

  /** Answers with a count that moves on every call. */
  @Get('counted')
  @CacheTTL(TTL)
  @UseInterceptors(CacheInterceptor)
  public counted(): { readonly calls: number } {
    calls += 1;
    return { calls };
  }

  /** Answers with a count, without the interceptor. */
  @Get('uncached')
  public uncached(): { readonly calls: number } {
    calls += 1;
    return { calls };
  }

  /** Answers with a count and the query's tenant. */
  @Get('seeded')
  @CacheTTL(TTL)
  @UseInterceptors(CacheInterceptor)
  public seeded(@Query() query: { readonly tenant?: string }): {
    readonly calls: number;
    readonly tenant: string;
  } {
    calls += 1;
    return { calls, tenant: query.tenant ?? 'none' };
  }

  /** Answers with what the cache holds under a key. */
  @Get('cached')
  public cached(): Promise<unknown> {
    return this.cache.get('COUNT');
  }

  /** Puts a value in the cache under a key. */
  @Get('seed')
  public async seed(
    @Query() query: { readonly key?: string },
  ): Promise<{
    readonly stored: string;
  }> {
    const key = query.key ?? 'COUNT';
    await this.cache.set(key, 'stored-value');
    return { stored: key };
  }
}

/** The module that wires the cached controller. */
@Module({
  controllers: [CachedController],
  imports: [CacheModule.register({ max: 10, ttl: TTL })],
})
class CacheModuleFixture {}

/** Forgets what a previous case counted. */
const resetCalls = (): void => {
  calls = 0;
};

export { CacheModuleFixture, resetCalls };
