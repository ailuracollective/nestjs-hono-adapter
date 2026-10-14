import type {
  NestRequest,
  ServerAdapter,
} from '#adapter/index';

/** The response surface a security hook writes through. */
interface SecurityResponse {
  setHeader: (name: string, value: string) => unknown;
  removeHeader: (name: string) => unknown;
}

/** The security hook Nest registers, as the base types it. */
type SecurityHook = (
  request: NestRequest,
  response: SecurityResponse,
) => unknown;

/** Reads the security hook the adapter installed. */
const securityHookOf = (
  adapter: ServerAdapter,
): ((hook: SecurityHook) => void) => {
  const installed: unknown = Reflect.get(
    adapter,
    'registerSecurityHook',
  );
  if (typeof installed !== 'function') {
    throw new TypeError(
      'The adapter did not install the security hook.',
    );
  }
  return (hook: SecurityHook): void => {
    Reflect.apply(installed, adapter, [hook]);
  };
};

/** What a security header carries when it is sent. */
const NOSNIFF = 'nosniff';

/** The address a proxy claims the request came from. */
const FORWARDED_FOR = '203.0.113.7, 10.0.0.1';

/** The host a proxy claims the request was sent to. */
const FORWARDED_HOST = 'api.example.com';

/** The headers a proxy claims the request came through. */
const forwarded = (): Record<string, string> => ({
  'x-forwarded-for': FORWARDED_FOR,
  'x-forwarded-host': FORWARDED_HOST,
  'x-forwarded-proto': 'https',
});

export { FORWARDED_HOST, NOSNIFF, forwarded, securityHookOf };
export type { SecurityHook, SecurityResponse };
