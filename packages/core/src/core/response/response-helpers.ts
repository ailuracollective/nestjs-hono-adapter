import type { NestContext } from '#adapter/core/context';

const RESPONSE_HELPERS = [
  'body',
  'html',
  'json',
  'newResponse',
  'notFound',
  'redirect',
  'text',
] as const;

type ResponseHelper = (...args: never[]) => Response;

type ResponseHelperCarrier = Record<(typeof RESPONSE_HELPERS)[number], ResponseHelper>;

const FITTED = Symbol('responseHelpers');

const SETTLED = Symbol('responseSettled');

interface Fitted {
  [FITTED]?: true;
}

interface SettledCarrier {
  [SETTLED]?: {
    readonly resolve: () => void;
    readonly settled: Promise<void>;
  };
}

const wrapHelper = (
  carrier: ResponseHelperCarrier,
  name: (typeof RESPONSE_HELPERS)[number],
  context: NestContext,
): void => {
  const helper = carrier[name];
  if (typeof helper !== 'function') return;
  carrier[name] = (...args: never[]): Response => {
    const response = helper.apply(context, args);
    context.res = response;
    return response;
  };
};

const responseDescriptor = (context: NestContext): PropertyDescriptor | undefined => {
  let holder: object | null = Reflect.getPrototypeOf(context);
  while (holder !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(holder, 'res');
    if (descriptor !== undefined) return descriptor;
    holder = Reflect.getPrototypeOf(holder);
  }
  return undefined;
};

interface Accessors {
  readonly read: () => Response;
  readonly write: (response: Response) => void;
}

const accessorsOf = (context: NestContext): Accessors | undefined => {
  const descriptor = responseDescriptor(context);
  if (descriptor === undefined) return undefined;
  // oxlint-disable-next-line typescript/unbound-method -- both are invoked with `.call` against the context the descriptor was read from.
  const { get, set } = descriptor;
  if (get === undefined || set === undefined) return undefined;
  return {
    read: (): Response => get.call(context) as Response,
    write: (response: Response): void => {
      set.call(context, response);
    },
  };
};

/**
 * Hono builds these seven helpers as own properties of each context, so they can only be wrapped
 * per request; the mark is what keeps the error path from wrapping them a second time.
 */
const finalizeOnResponse = (context: NestContext): void => {
  const carrier = context as unknown as ResponseHelperCarrier & Fitted;
  if (carrier[FITTED] === true) return;
  carrier[FITTED] = true;
  for (const name of RESPONSE_HELPERS) {
    wrapHelper(carrier, name, context);
  }
};

/**
 * Resolves once the response has been assigned on the context. Everything lands there — a
 * Node-style `res.send`, the helpers `finalizeOnResponse` routes through `context.res`, and a route
 * that builds its own `Response`. A middleware may defer `next` (graphql-upload calls it only after
 * the body has been read), so the chain waits on this rather than assuming `next` already ran.
 */
const whenResponseSettled = (context: NestContext): Promise<void> => {
  const carrier = context as unknown as SettledCarrier;
  const held = carrier[SETTLED];
  if (held !== undefined) return held.settled;
  const accessors = accessorsOf(context);
  if (accessors === undefined) return Promise.resolve();
  const resolvers = Promise.withResolvers<undefined>();
  carrier[SETTLED] = {
    resolve: (): void => {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- the resolver of a `void` promise needs its (ignored) argument once the type parameter is `undefined`.
      resolvers.resolve(undefined);
    },
    settled: resolvers.promise,
  };
  Object.defineProperty(context, 'res', {
    configurable: true,
    get: accessors.read,
    set(response: Response): void {
      accessors.write(response);
      const current = carrier[SETTLED];
      if (current !== undefined) current.resolve();
    },
  });
  return resolvers.promise;
};

export { finalizeOnResponse, whenResponseSettled };
