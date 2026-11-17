interface RequestShape {
  readonly get?: (name: string) => string | undefined;
  readonly headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}

const MISSING = -1;

const parseCookie = (part: string): [name: string, value: string] | undefined => {
  const index = part.indexOf('=');
  if (index === MISSING) return undefined;
  const name = part.slice(0, index).trim();
  if (name === '') return undefined;
  const raw = part.slice(index + 1).trim();
  try {
    return [name, decodeURIComponent(raw)];
  } catch {
    return [name, raw];
  }
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  if (header === undefined) return out;
  for (const part of header.split(';')) {
    const pair = parseCookie(part);
    if (pair !== undefined) {
      const [name, value] = pair;
      out[name] = value;
    }
  }
  return out;
};

// A single header read, not the whole record: the CSRF guard only wants `Cookie`.
const cookieHeader = (req: RequestShape): string | undefined => {
  if (typeof req.get === 'function') return req.get('cookie');
  const { headers } = req;
  if (headers === undefined) return undefined;
  const { Cookie, cookie } = headers;
  const value = cookie ?? Cookie;
  if (Array.isArray(value)) return value[0];
  return value;
};

export { cookieHeader, parseCookies };
export type { RequestShape };
