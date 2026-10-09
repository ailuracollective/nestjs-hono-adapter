/**
 * The cases that show the request context survives the adapter.
 *
 * Two of the ecosystem packages depend on this without ever
 * saying so in an HTTP test: `@nestjs/event-emitter` resolves a
 * request-scoped listener by the context id it reads off the
 * request, and `@nestjs/cqrs` resolves a request-scoped handler
 * the same way. Both work against a testing module in their own
 * suites, where the request is registered by hand — so neither
 * suite covers the thing an adapter has to get right, which is
 * that the context Nest builds for an incoming request is the
 * one the handler sees.
 *
 * The claims here are therefore about the adapter rather than
 * about either package: the `REQUEST` provider is the object
 * the route was handed, and two requests in flight at once do
 * not share one.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
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

import type { NestRequest } from '../src/index.ts';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/**
 * How many request-scoped providers have been built. A fresh
 * value per resolution is what makes the assertions mean
 * anything: a singleton would answer the same for both
 * requests.
 */
let resolutions = 0;

/**
 * What one answer carries back, so a case can compare two of
 * them.
 */
interface Seen {
  readonly same: boolean;
  readonly serial: number;
  readonly url: string;
}

/**
 * A provider built once per request, holding the request Nest
 * resolved for it. It answers three things a case needs:
 * whether that request is the one the route was handed, which
 * resolution of the provider this is, and what URL it saw.
 */
@Injectable({ scope: Scope.REQUEST })
class ScopedReader {
  private readonly source: NestRequest;

  /** Which resolution of this provider this is. */
  public readonly serial: number;

  public constructor(@Inject(REQUEST) source: NestRequest) {
    this.source = source;
    resolutions += 1;
    this.serial = resolutions;
  }

  /**
   * Whether the injected request is the one the route was
   * given.
   */
  public isSameAs(other: NestRequest): boolean {
    return this.source === other;
  }

  /** The URL of the request this provider was built for. */
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

  /**
   * Answers what the request-scoped provider saw, and whether
   * it saw this route's request. The route's request is handed
   * to the provider rather than injected alongside it, so the
   * two are compared rather than assumed to be the same
   * object.
   */
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

/**
 * Reads what an answer reported.
 *
 * Narrowed field by field rather than asserted whole, because
 * the body arrives as `unknown` and a case that trusted its own
 * shape would pass on an answer that was not the one it meant
 * to check.
 */
function seenOf(body: unknown): Seen {
  if (typeof body !== 'object' || body === null) {
    throw new TypeError(
      'the route did not answer with an object',
    );
  }
  const same: unknown = Reflect.get(body, 'same');
  const serial: unknown = Reflect.get(body, 'serial');
  const url: unknown = Reflect.get(body, 'url');
  if (
    typeof same !== 'boolean' ||
    typeof serial !== 'number' ||
    typeof url !== 'string'
  ) {
    throw new TypeError(
      'the route did not answer what the case reads',
    );
  }
  return { same, serial, url };
}

/** Reads what one answer reported. */
async function seenBy(
  probe: Probe,
  path = '/seen',
): Promise<Seen> {
  const answered = await request(probe, path);
  return seenOf(answered.body);
}

/** Starts the fixture with the counter the serials come from. */
async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  resolutions = 0;
  const probe = await startProbe({
    mode: 'in-process',
    module: ContextModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

test('the request Nest injects is the one the route was handed', async () => {
  await withProbe(async (probe) => {
    const seen = await seenBy(probe);

    expect(seen.same).toBe(true);
  });
});

test('a request-scoped provider sees the URL of its own request', async () => {
  await withProbe(async (probe) => {
    const seen = await seenBy(probe);

    expect(seen.url).toBe('/seen');
  });
});

test('a request-scoped provider is built once for one request', async () => {
  await withProbe(async (probe) => {
    const seen = await seenBy(probe);

    // One resolution for the one request: a provider built per
    // consumer instead would leave this above what one request
    // costs, which is the failure the scope exists to prevent.
    expect(seen.serial).toBe(1);
  });
});

test('two requests do not share one request-scoped provider', async () => {
  await withProbe(async (probe) => {
    const first = await seenBy(probe);
    const second = await seenBy(probe);

    expect(second.serial).toBe(first.serial + 1);
  });
});

test('two requests in flight at once do not share a provider', async () => {
  await withProbe(async (probe) => {
    const answers = await Promise.all([
      seenBy(probe),
      seenBy(probe),
    ]);
    const [first, second] = answers;

    expect(second.serial).not.toBe(first.serial);
  });
});

test('the request context holds over a connection as well', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: ContextModule,
  });
  try {
    const response = await request(probe, '/seen');

    expect(seenOf(response.body).same).toBe(true);
  } finally {
    await probe.close();
  }
});
