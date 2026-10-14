import { bunAdapter } from '#test/bun-adapter';
import { bodyOf } from '#test/probe/in-process';
import type { Probe, ProbeOptions, ProbeResult } from '#test/probe/types';

import { startApplication } from './start.ts';

const request = async (probe: Probe, path: string, init?: RequestInit): Promise<ProbeResult> => {
  const response = await probe.respond(path, init);
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  return {
    body: bodyOf(text, contentType),
    contentType,
    headers: response.headers,
    status: response.status,
    text,
  };
};

const startProbe = (options: ProbeOptions = {}): Promise<Probe> => {
  const { module } = options;
  if (module === undefined)
    throw new TypeError('a probe built without the fixture names its own module');
  return startApplication(bunAdapter(options.adapter), module, options);
};

export { request, startProbe };
