import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { NestHono } from '#adapter/core/context';

interface FetchHandlerOptions {
  readonly clientAddress?: (request: Request) => string | undefined;
}

const fetchHandler =
  (app: NestHono, options: FetchHandlerOptions = {}): ((request: Request) => Promise<Response>) =>
  (request: Request): Promise<Response> => {
    let address: string | undefined = undefined;
    if (options.clientAddress !== undefined) address = options.clientAddress(request);
    const incoming = new RequestCarrier(address);
    request.signal.addEventListener(
      'abort',
      () => {
        incoming.emit('close');
      },
      { once: true },
    );
    return Promise.resolve(app.fetch(request, { incoming }));
  };

export { fetchHandler };
export type { FetchHandlerOptions };
