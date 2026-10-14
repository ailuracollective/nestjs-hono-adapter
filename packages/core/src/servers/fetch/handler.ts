import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { NestHono } from '#adapter/core/context';

/** The trusted request metadata a fetch host can supply. */
interface FetchHandlerOptions {
  /** Resolves a trusted address supplied by the host. */
  readonly clientAddress?: (
    request: Request,
  ) => string | undefined;
}

/** Wraps a Hono application as the fetch a host exports. */
const fetchHandler =
  (
    app: NestHono,
    options: FetchHandlerOptions = {},
  ): ((request: Request) => Promise<Response>) =>
  (request: Request): Promise<Response> => {
    let address: string | undefined = undefined;
    if (options.clientAddress !== undefined) {
      address = options.clientAddress(request);
    }
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
