import type { BridgeAdapter, NestContext } from '@ailura/nestjs-hono-adapter';

import { absoluteUrl, fragmentResponse, isInertia, isPrefetch, varyOn } from './redirect-target.ts';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.adapter');

const SAFE_METHODS = new Set(['PUT', 'PATCH', 'DELETE', 'QUERY']);
const FOUND = 302;
const SEE_OTHER = 303;

type ReplyArgs = [response: NestContext, body: unknown, statusCode?: number];
type RedirectArgs = [response: NestContext, statusCode: number, url: string];

const isInertiaUnsafe = (response: NestContext): boolean =>
  SAFE_METHODS.has(response.req.method) && response.req.header('X-Inertia') !== undefined;

/**
 * Nest's post-handler must not overwrite a response Inertia already wrote, and a `302` after a safe
 * method must become a `303` for `@Redirect()`. The patch is per application, not per class.
 */
const patchAdapter = (adapter: BridgeAdapter): void => {
  if (Reflect.get(adapter, PATCHED) === true) return;
  Reflect.set(adapter, PATCHED, true);

  const originalReply: unknown = Reflect.get(adapter, 'reply');
  if (typeof originalReply === 'function') {
    Reflect.set(adapter, 'reply', function reply(this: BridgeAdapter, ...args: ReplyArgs): void {
      const [response] = args;
      if (response.finalized) return;
      Reflect.apply(originalReply, this, args);
    });
  }

  const originalRedirect: unknown = Reflect.get(adapter, 'redirect');
  if (typeof originalRedirect === 'function') {
    Reflect.set(
      adapter,
      'redirect',
      function redirect(this: BridgeAdapter, ...args: RedirectArgs): void {
        const [response, statusCode, url] = args;
        varyOn(response);
        if (isInertia(response) && !isPrefetch(response) && url.includes('#')) {
          fragmentResponse(response, absoluteUrl(response, url));
          return;
        }
        const next = statusCode === FOUND && isInertiaUnsafe(response) ? SEE_OTHER : statusCode;
        Reflect.apply(originalRedirect, this, [response, next, url]);
      },
    );
  }
};

export { patchAdapter };
