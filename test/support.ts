import 'reflect-metadata';

import { Readable } from 'node:stream';

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
  Redirect,
  Render,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
  INestApplication,
  NestApplicationOptions,
  Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type {
  NestContext,
  NestRequest,
  ServerAdapterOptions,
} from '../src/index.ts';
import { ServerAdapter } from '../src/index.ts';
import { createRouteHandler } from '../src/core/handler-bridge.ts';
import type { StreamInterceptor } from '../src/core/handler-bridge.ts';

/** The port a probe asks the system to pick for it. */
const ANY_PORT = 0;

/** The interface a probe listens on. */
const LOCALHOST = '127.0.0.1';

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
}

/**
 * A controller that answers the way an imperative handler does,
 * through the response object rather than a returned value.
 */
@Controller('response')
class ResponseController {
  @Get('imperative')
  public imperative(@Res() response: NestContext): void {
    response.json({ imperative: true }, HttpStatus.CREATED);
  }

  @Get('passthrough')
  public passthrough(
    @Res({ passthrough: true }) response: NestContext,
  ): unknown {
    response.header('x-passthrough', 'yes');
    return { passthrough: true };
  }

  @Get('decorated')
  @Header('x-decorated', 'yes')
  @HttpCode(HttpStatus.ACCEPTED)
  public decorated(): unknown {
    return { decorated: true };
  }

  @Get('redirect')
  @Redirect(
    'https://example.com/',
    HttpStatus.MOVED_PERMANENTLY,
  )
  public redirect(): unknown {
    return {};
  }

  @Get('file')
  public file(): StreamableFile {
    return new StreamableFile(Readable.from(['streamed']), {
      disposition: 'attachment; filename="note.txt"',
      type: 'text/plain',
    });
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
  controllers: [
    ProbeController,
    ResponseController,
    ViewController,
  ],
})
class ProbeModule {}

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

/** What one request through a running application saw. */
interface ProbeResult {
  readonly body: unknown;
  readonly contentType: string;
  readonly headers: Headers;
  readonly status: number;
  readonly text: string;
}

/** A running application a test talks to. */
interface Probe {
  readonly adapter: ServerAdapter;
  readonly app: INestApplication;
  readonly origin: string;
  close: () => Promise<void>;
}

/** How a probe is built, when the defaults are not enough. */
interface ProbeOptions {
  readonly adapter?: ServerAdapterOptions;
  readonly application?: NestApplicationOptions;
  readonly configure?: (app: INestApplication) => void;
  /**
   * The module the application is built from, when the probe
   * module is not the one a case needs.
   */
  readonly module?: Type<unknown>;
}

/**
 * The Nest options for a probe, quiet unless a case asks
 * otherwise.
 */
function applicationOptions(
  given: NestApplicationOptions | undefined,
): NestApplicationOptions {
  const merged: NestApplicationOptions = { logger: false };
  if (given === undefined) {
    return merged;
  }
  Object.assign(merged, given);
  merged.logger = given.logger ?? false;
  return merged;
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function bodyOf(text: string, contentType: string): unknown {
  if (!contentType.includes('json') || text === '') {
    return text;
  }
  return parseJson(text);
}

/**
 * Starts an application of its own on an ephemeral port.
 *
 * Every case gets its own application, so no case can pass
 * because another one left a server, a filter or a route
 * behind.
 */
/**
 * Starts an application on an adapter the caller already built,
 * which is what a case that configures Hono itself needs: a
 * middleware only runs if it is registered before the
 * application listens.
 */
async function startAdapter(
  adapter: ServerAdapter,
  options: ProbeOptions = {},
): Promise<Probe> {
  const app = await NestFactory.create(
    options.module ?? ProbeModule,
    adapter,
    applicationOptions(options.application),
  );
  if (options.configure !== undefined) {
    options.configure(app);
  }
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new TypeError(
      'the adapter is not listening on a port',
    );
  }
  return {
    adapter,
    app,
    close: () => app.close(),
    origin: `http://${LOCALHOST}:${address.port}`,
  };
}

async function request(
  probe: Probe,
  path: string,
  init?: RequestInit,
): Promise<ProbeResult> {
  const response = await fetch(`${probe.origin}${path}`, init);
  const text = await response.text();
  const contentType =
    response.headers.get('content-type') ?? '';
  return {
    body: bodyOf(text, contentType),
    contentType,
    headers: response.headers,
    status: response.status,
    text,
  };
}

/** The body of a JSON request, with the headers it needs. */
function jsonRequest(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  };
}

function startProbe(
  options: ProbeOptions = {},
): Promise<Probe> {
  return startAdapter(
    new ServerAdapter(options.adapter),
    options,
  );
}

/** The route a probe serves a case's own bridge on. */
const BRIDGE_ROUTE = '/bridge/probe';

/** The status a probe's bridge reports to an interceptor. */
const PENDING_STATUS = HttpStatus.ACCEPTED;

/** What one request through a case's own bridge answered. */
interface BridgeAnswer {
  readonly status: number;
  readonly text: string;
}

/**
 * Serves one route through a bridge whose stream interceptor is
 * the caller's, so a case can prove which one was opened. The
 * route is registered before the first request, because Hono's
 * router is already built once a probe has answered anything.
 */
async function mountStream(
  probe: Probe,
  interceptor: StreamInterceptor,
): Promise<BridgeAnswer> {
  const bridge = createRouteHandler(
    (): Promise<unknown> => Promise.resolve(),
    {
      bodyLimit: () => 0,
      bodyParsingEnabled: () => false,
      pendingStatus: () => PENDING_STATUS,
      rawBody: () => false,
      trustProxy: () => false,
    },
    interceptor,
  );
  probe.adapter.getHono().on('GET', BRIDGE_ROUTE, bridge);
  const answer = await fetch(`${probe.origin}${BRIDGE_ROUTE}`);
  return { status: answer.status, text: await answer.text() };
}

export {
  MarkerFilter,
  ProbeModule,
  jsonRequest,
  mountStream,
  request,
  startAdapter,
  startProbe,
};
export type { Probe, ProbeOptions, ProbeResult };
