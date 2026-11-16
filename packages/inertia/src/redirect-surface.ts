import type { RedirectResponse } from './redirect-inspect.ts';

const FOUND = 302;
const SEE_OTHER = 303;

const patchHonoRedirect = (res: RedirectResponse): void => {
  const original: unknown = Reflect.get(res, 'redirect');
  if (typeof original !== 'function') return;
  Reflect.set(res, 'redirect', (statusOrUrl: number | string, url?: string | number): unknown => {
    if (typeof statusOrUrl === 'number') {
      const status = statusOrUrl === FOUND ? SEE_OTHER : statusOrUrl;
      return Reflect.apply(original, res, [status, url]);
    }
    let status = SEE_OTHER;
    if (typeof url === 'number') status = url === FOUND ? SEE_OTHER : url;
    return Reflect.apply(original, res, [statusOrUrl, status]);
  });
};

export { patchHonoRedirect };
