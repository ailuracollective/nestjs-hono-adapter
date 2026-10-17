import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { Incoming } from '#adapter/core/ports/bindings';

import type { NestHono } from '#adapter/core/context';
import type { BunRuntime } from '#adapter/servers/bun-runtime';

const fetchOf = (
  app: NestHono,
  request: Request,
  server: BunRuntime,
): Response | Promise<Response> => {
  const remote = server.requestIP(request);
  const incoming = new RequestCarrier(remote === null ? undefined : remote.address);
  if (request.signal.aborted) {
    (incoming as Incoming).closed = true;
    incoming.emit('close');
  } else {
    request.signal.addEventListener(
      'abort',
      () => {
        (incoming as Incoming).closed = true;
        incoming.emit('close');
      },
      { once: true },
    );
  }
  return app.fetch(request, { incoming, server });
};

export { fetchOf };
