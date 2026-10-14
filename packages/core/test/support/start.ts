import { HttpException, HttpStatus } from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
} from '@nestjs/common';

import type {
  NestContext,
  ServerAdapter,
} from '#adapter/index';
import { bunAdapter } from '#test/bun-adapter';
import { startApplication } from '#test/probe';
import type { Probe, ProbeOptions } from '#test/probe';
import { ProbeModule } from './probe-controller.ts';

/** The status an exception carries, or a server error. */
const httpStatusOf = (exception: unknown): number => {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
};

/** Answers every exception with a marked body. */
class MarkerFilter implements ExceptionFilter {
  /** Answers the exception with a marked JSON body. */
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
const jsonRequest = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});

/** Starts an application on an already built adapter. */
const startAdapter = (
  adapter: ServerAdapter,
  options: ProbeOptions = {},
): Promise<Probe> => {
  const module = options.module ?? ProbeModule;
  return startApplication(adapter, module, options);
};

/** Starts an application on an adapter of its own. */
const startProbe = (
  options: ProbeOptions = {},
): Promise<Probe> =>
  startAdapter(bunAdapter(options.adapter), options);

export { MarkerFilter, jsonRequest, startAdapter, startProbe };
