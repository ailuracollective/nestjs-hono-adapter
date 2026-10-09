/**
 * The cases that show `@nestjs/cache-manager` works on this
 * adapter.
 *
 * The package's interesting surface for an adapter is its
 * interceptor, which sits between the route and the caller and
 * answers a second request from what it kept of the first. That
 * makes it the one package here whose value the adapter has to
 * leave alone: if the interceptor were not reached, or its
 * answer were not the one written out, the cached value and the
 * fresh one would be indistinguishable — so every cached case
 * here changes something the route would otherwise answer with,
 * and reads it back twice.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
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

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** How long a cached answer is kept, in milliseconds. */
const TTL = 60_000;

/**
 * How many answers a call has been made, which is what changes
 * between two reads of the same route.
 */
let calls = 0;

/** The shape the cache holds answers in. */
interface Cache {
  readonly del: (key: string) => Promise<void>;
  readonly get: <Held>(
    key: string,
  ) => Promise<Held | undefined>;
  readonly set: (
    key: string,
    value: unknown,
    ttl?: number,
  ) => Promise<unknown>;
}

@Controller()
class CachedController {
  private readonly cache: Cache;

  public constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    this.cache = cache;
  }

  /**
   * Answers with a call count that moves on every call, so a
   * case can tell a fresh answer from one the interceptor
   * kept.
   */
  @Get('counted')
  @CacheTTL(TTL)
  @UseInterceptors(CacheInterceptor)
  public counted(): { readonly calls: number } {
    calls += 1;
    return { calls };
  }

  /**
   * The same route without the interceptor, which is the
   * comparison that makes the cached one mean anything.
   */
  @Get('uncached')
  public uncached(): { readonly calls: number } {
    calls += 1;
    return { calls };
  }

  /**
   * The same route as `counted`, reachable with a query. The
   * cache key the interceptor builds comes from the adapter's
   * own URL, so two queries of one route are the pair that
   * shows that URL carries the query rather than only the
   * path.
   */
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

  /** Answers with what the cache holds under a key, or nothing. */
  @Get('cached')
  public cached(): Promise<unknown> {
    return this.cache.get('COUNT');
  }

  /**
   * Puts a value in the cache under a key of the case's
   * choosing.
   */
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

@Module({
  controllers: [CachedController],
  imports: [CacheModule.register({ max: 10, ttl: TTL })],
})
class CacheModuleFixture {}

/**
 * Forgets what a previous case counted, so each starts at
 * nothing.
 */
async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  calls = 0;
  const probe = await startProbe({
    mode: 'in-process',
    module: CacheModuleFixture,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

test('a route under the interceptor does not move on the second read', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/counted');
    const second = await request(probe, '/counted');

    expect(first.body).toStrictEqual({ calls: 1 });
    expect(second.body).toStrictEqual({ calls: 1 });
  });
});

test('a route without the interceptor moves on every call', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/uncached');
    const second = await request(probe, '/uncached');

    expect(first.body).toStrictEqual({ calls: 1 });
    expect(second.body).toStrictEqual({ calls: 2 });
  });
});

test('the interceptor keeps the first answer', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/counted');
    const kept = await request(probe, '/counted');

    expect(first.status).toBe(HttpStatus.OK);
    expect(kept.status).toBe(HttpStatus.OK);
    expect(kept.body).toStrictEqual(first.body);
  });
});

test('the route under the interceptor ran once for two requests', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/counted');
    await request(probe, '/counted');

    const uncached = await request(probe, '/uncached');
    expect(uncached.body).toStrictEqual({ calls: 2 });
  });
});

test('a value put in the cache is read back', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/seed');
    const response = await request(probe, '/cached');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe('stored-value');
  });
});

test('the interceptor says on the answer whether it was a miss', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/counted');

    // The header is the interceptor's own report, and it only
    // reaches the wire if the adapter carried a header written
    // through `setHeader` after it had taken the response over.
    expect(first.headers.get('x-cache')).toBe('MISS');
  });
});

test('the interceptor says on the answer when it was a hit', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/counted');
    const kept = await request(probe, '/counted');

    expect(kept.headers.get('x-cache')).toBe('HIT');
  });
});

test('a route without the interceptor says nothing about the cache', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/uncached');

    // The absence is the point: the header appears because the
    // interceptor wrote it, and a header that appeared on its own
    // would mean something else wrote it.
    expect(response.headers.get('x-cache')).toBeNull();
  });
});

test('two queries of one route are two cache keys', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/seeded?tenant=one');
    const other = await request(probe, '/seeded?tenant=two');

    expect(first.headers.get('x-cache')).toBe('MISS');
    expect(other.headers.get('x-cache')).toBe('MISS');
  });
});

test('a cached route answers over a real connection', async () => {
  calls = 0;
  const probe = await startProbe({
    mode: 'socket',
    module: CacheModuleFixture,
  });
  try {
    const first = await request(probe, '/counted');
    const kept = await request(probe, '/counted');

    expect(first.status).toBe(HttpStatus.OK);
    expect(kept.body).toStrictEqual(first.body);
  } finally {
    await probe.close();
  }
});
