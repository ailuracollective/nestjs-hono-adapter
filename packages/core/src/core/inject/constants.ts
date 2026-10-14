import type { InjectCookie } from './types.ts';

/** The options refused rather than ignored. */
const REFUSED: Record<string, string> = {
  /** The request class is not supported. */
  Request:
    'a request class describes a socket this call never opens',
  /** The authority belongs to the target, not to the call. */
  authority:
    'the authority belongs to the target, not to the call',
  /**
   * The remote address belongs to the transport, not to the
   * call.
   */
  payloadAsStream:
    'the payload is read as bytes, never as a stream',
  /**
   * The remote address belongs to the transport, not to the
   * call.
   */
  remoteAddress: 'the client address comes from the transport',
};

/** What `indexOf` answers when the separator is not there. */
const NOT_FOUND = -1;

/** How each `set-cookie` attribute maps onto the cookie. */
const ATTRIBUTES: Record<
  string,
  (cookie: InjectCookie, value: string) => void
> = {
  expires: (cookie, value): void => {
    cookie.expires = new Date(value);
  },
  httponly: (cookie): void => {
    cookie.httpOnly = true;
  },
  'max-age': (cookie, value): void => {
    cookie.maxAge = Number(value);
  },
  samesite: (cookie, value): void => {
    cookie.sameSite = value;
  },
  secure: (cookie): void => {
    cookie.secure = true;
  },
};

export { REFUSED, NOT_FOUND, ATTRIBUTES };
