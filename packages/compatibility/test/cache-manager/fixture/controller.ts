import 'reflect-metadata';

import { Controller, Get, Inject, Module, Query, UseInterceptors } from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor, CacheModule, CacheTTL } from '@nestjs/cache-manager';

import { TTL } from './cache.ts';
import type { Cache } from './cache.ts';

let calls = 0;

@Controller()
class CachedController {
  private readonly cache: Cache;

  public constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    this.cache = cache;
  }

  @Get('counted')
  @CacheTTL(TTL)
  @UseInterceptors(CacheInterceptor)
  public counted(): { readonly calls: number } {
    calls += 1;
    return { calls };
  }

  @Get('uncached')
  public uncached(): { readonly calls: number } {
    calls += 1;
    return { calls };
  }

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

  @Get('cached')
  public cached(): Promise<unknown> {
    return this.cache.get('COUNT');
  }

  @Get('seed')
  public async seed(@Query() query: { readonly key?: string }): Promise<{
    readonly stored: string;
  }> {
    const key = query.key ?? 'COUNT';
    await this.cache.set(key, 'stored-value');
    return { stored: key };
  }
}

@Module({
  controllers: [CachedController],
  imports: [CacheModule.register({ max: 10, ttl: TTL })],
})
class CacheModuleFixture {}

const resetCalls = (): void => {
  calls = 0;
};

export { CacheModuleFixture, resetCalls };
