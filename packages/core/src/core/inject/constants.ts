import type { InjectCookie } from './types.ts';

const REFUSED: Record<string, string> = {
  Request: 'a request class describes a socket this call never opens',
  authority: 'the authority belongs to the target, not to the call',
  payloadAsStream: 'the payload is read as bytes, never as a stream',
  remoteAddress: 'the client address comes from the transport',
};

const NOT_FOUND = -1;

const ATTRIBUTES: Record<string, (cookie: InjectCookie, value: string) => void> = {
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
