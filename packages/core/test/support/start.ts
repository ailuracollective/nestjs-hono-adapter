import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import type { NestContext, ServerAdapter } from '#adapter/index';
import { bunAdapter } from '#test/bun-adapter';
import { startApplication } from '#test/probe';
import type { Probe, ProbeOptions } from '#test/probe';
import { ProbeModule } from './probe-controller.ts';

const httpStatusOf = (exception: unknown): number => {
  if (exception instanceof HttpException) return exception.getStatus();
  return HttpStatus.INTERNAL_SERVER_ERROR;
};

class MarkerFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const status = httpStatusOf(exception);
    const response = host.switchToHttp().getResponse<NestContext>();
    const answer = Response.json({ status }, { status });
    answer.headers.set('x-filtered', 'yes');
    response.res = answer;
  }
}

const jsonRequest = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});

const startAdapter = (adapter: ServerAdapter, options: ProbeOptions = {}): Promise<Probe> => {
  const module = options.module ?? ProbeModule;
  return startApplication(adapter, module, options);
};

const startProbe = (options: ProbeOptions = {}): Promise<Probe> =>
  startAdapter(bunAdapter(options.adapter), options);

export { MarkerFilter, jsonRequest, startAdapter, startProbe };
