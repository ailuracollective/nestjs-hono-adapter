import {
  RequestCarrier,
  remoteAddressOf,
} from '#adapter/core/ports/bindings';

import type { NestHono } from '#adapter/core/context';
import type { BunRuntime } from '#adapter/servers/bun-runtime';

/** Hands a request to Hono with the bindings Nest reads. */
const fetchOf = (
  app: NestHono,
  request: Request,
  server: BunRuntime,
): Response | Promise<Response> => {
  const incoming = new RequestCarrier(
    remoteAddressOf(server.requestIP(request)),
  );
  request.signal.addEventListener(
    'abort',
    () => {
      incoming.emit('close');
    },
    { once: true },
  );
  return app.fetch(request, { incoming, server });
};

export { fetchOf };
