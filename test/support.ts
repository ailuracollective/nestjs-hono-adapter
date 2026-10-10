import 'reflect-metadata';

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Module,
  Post,
  Query,
  QueryMethod,
  Render,
  Req,
  Sse,
} from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
  MessageEvent,
} from '@nestjs/common';
import { Observable, Subject, of, throwError } from 'rxjs';

import type {
  NestContext,
  NestRequest,
  ServerAdapter,
} from '../src/index.ts';
import { bunAdapter } from './bun-adapter.ts';
import { startApplication } from './probe.ts';
import type { Probe, ProbeOptions } from './probe.ts';

/** What a body that is not binary is reported as. */
const NOT_BINARY = -1;

/**
 * A controller just large enough to exercise the bridge: one
 * route per behaviour the adapter has to translate.
 */
@Controller()
class ProbeController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  @Get('text')
  public text(): string {
    return 'plain';
  }

  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('query')
  public query(@Query() query: unknown): unknown {
    return query;
  }

  @QueryMethod('lookup')
  public lookup(@Req() source: NestRequest): unknown {
    return { method: source.method };
  }

  @Get('boom')
  public boom(): never {
    throw new ForbiddenException('nope');
  }

  @Post('upload')
  public upload(@Req() source: NestRequest): unknown {
    return {
      body: source.body,
      files: Object.keys(source.files ?? {}),
    };
  }

  @Post('binary')
  public binary(@Req() source: NestRequest): unknown {
    const { body } = source;
    if (body instanceof Uint8Array) {
      return { bytes: body.byteLength };
    }
    return { bytes: NOT_BINARY };
  }

  @Post('raw')
  public raw(@Req() source: NestRequest): unknown {
    const { rawBody } = source;
    if (rawBody === undefined) {
      return { raw: '' };
    }
    return { raw: rawBody.toString('utf8') };
  }

  @Get('request')
  public request(@Req() source: NestRequest): unknown {
    return {
      hostname: source.hostname,
      ip: source.ip,
      ips: source.ips,
      protocol: source.protocol,
      secure: source.secure,
    };
  }

  /**
   * A route whose path ends in a named wildcard, so a case can
   * read the capture the router answers with.
   */
  @Get('files/*rest')
  public files(@Req() source: NestRequest): unknown {
    return { params: source.params };
  }
}

/** A controller that answers with a rendered template. */
@Controller('view')
class ViewController {
  @Get()
  @Render('hello')
  public hello(): unknown {
    return { name: 'Nest' };
  }

  @Get('missing')
  @Render('missing')
  public missing(): unknown {
    return {};
  }
}

@Module({
  controllers: [ProbeController, ViewController],
})
class ProbeModule {}

/** How long the second frame of the slow route waits. */
const SECOND_FRAME_DELAY = 300;

/** How often the open route ticks while the client listens. */
const TICK_INTERVAL = 10;

/** How many frames the flood route writes with no pause. */
const FLOOD_FRAMES = 64;

/**
 * Says when the open route was torn down.
 *
 * The subject is a fixture member rather than one a case makes
 * for itself: the route that fires it lives here too, so a
 * subject created inside a case would be a different subject
 * from the one the route writes to, and the case could only
 * ever wait on its own silence.
 */
const torn = new Subject<void>();

/**
 * The routes every event-stream case starts from: one that
 * answers at its own pace, one that names every frame field,
 * one that answers through a promise, two that fail, one that
 * answers with a status and a header of its own, one that
 * floods an unread stream, and one that never ends.
 */
@Controller()
class SseController {
  @Sse('sse/slow')
  public slow(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'first' });
      const timer = setTimeout(() => {
        subscriber.next({ data: 'second' });
        subscriber.complete();
      }, SECOND_FRAME_DELAY);
      return (): void => {
        clearTimeout(timer);
      };
    });
  }

  @Sse('sse/frames')
  @Header('x-stream', 'yes')
  public frames(): Observable<MessageEvent> {
    return of({
      data: { count: 1 },
      id: 'two',
      retry: 3000,
      type: 'tick',
    });
  }

  @Sse('sse/promise')
  public promised(): Promise<Observable<MessageEvent>> {
    return Promise.resolve(of({ data: 'deferred' }));
  }

  @Sse('sse/throws')
  public throws(): Observable<MessageEvent> {
    throw new ForbiddenException('no stream');
  }

  @Sse('sse/errors')
  public errors(): Observable<MessageEvent> {
    return throwError(() => new Error('stream failed'));
  }

  @Sse('sse/broken')
  public broken(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'open' });
      subscriber.error(new Error('after the frame'));
    });
  }

  /**
   * Answers with a status and a header the handler never names
   * itself, so a case can tell whether the adapter passed on
   * what Nest read from the route metadata.
   */
  @Sse('sse/decorated')
  @Header('x-stream', 'yes')
  @HttpCode(HttpStatus.ACCEPTED)
  public decorated(): Observable<MessageEvent> {
    return of({ data: 'decorated' });
  }

  /**
   * Writes more frames than a stream holds, pausing for no
   * reader, so a case can tell whether a full queue holds the
   * writer and a stalled reader is caught up whole.
   */
  @Sse('sse/flood')
  public flood(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      for (let count = 0; count < FLOOD_FRAMES; count += 1) {
        subscriber.next({ data: { count } });
      }
      subscriber.complete();
    });
  }

  @Sse('sse/open')
  public open(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'open' });
      const timer = setInterval(() => {
        subscriber.next({ data: 'tick' });
      }, TICK_INTERVAL);
      return (): void => {
        torn.next();
        clearInterval(timer);
      };
    });
  }
}

@Module({ controllers: [SseController] })
class SseModule {}

/** The status an exception carries, or a server error. */
function httpStatusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Marks every exception it sees, so a test can prove that a
 * failure went through the exception layer rather than being
 * answered by the adapter itself.
 */
class MarkerFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const status = httpStatusOf(exception);
    const response = host
      .switchToHttp()
      .getResponse<NestContext>();
    const answer = Response.json({ status }, { status });
    answer.headers.set('x-filtered', 'yes');
    response.res = answer;
  }
}

/** The body of a JSON request, with the headers it needs. */
function jsonRequest(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  };
}

/**
 * Starts an application on the fixture above, on an adapter the
 * caller already built. The module a case did not name is named
 * here, which is why this entry point sits with the fixture
 * rather than with the plumbing in `./probe.ts`.
 */
function startAdapter(
  adapter: ServerAdapter,
  options: ProbeOptions = {},
): Promise<Probe> {
  const module = options.module ?? ProbeModule;
  return startApplication(adapter, module, options);
}

/**
 * Starts an application of its own on an adapter of its own,
 * from the fixture above unless a case names another module.
 */
function startProbe(
  options: ProbeOptions = {},
): Promise<Probe> {
  return startAdapter(bunAdapter(options.adapter), options);
}

export {
  FLOOD_FRAMES,
  MarkerFilter,
  ProbeModule,
  SECOND_FRAME_DELAY,
  SseModule,
  jsonRequest,
  startAdapter,
  startProbe,
  torn,
};
