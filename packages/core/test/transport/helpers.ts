import type { NestRequest, ServerAdapter } from '#adapter/index';

interface SecurityResponse {
  setHeader: (name: string, value: string) => unknown;
  removeHeader: (name: string) => unknown;
}

type SecurityHook = (request: NestRequest, response: SecurityResponse) => unknown;

const securityHookOf = (adapter: ServerAdapter): ((hook: SecurityHook) => void) => {
  const installed: unknown = Reflect.get(adapter, 'registerSecurityHook');
  if (typeof installed !== 'function')
    throw new TypeError('The adapter did not install the security hook.');
  return (hook: SecurityHook): void => {
    Reflect.apply(installed, adapter, [hook]);
  };
};

const NOSNIFF = 'nosniff';

const FORWARDED_FOR = '203.0.113.7, 10.0.0.1';

const FORWARDED_HOST = 'api.example.com';

const forwarded = (): Record<string, string> => ({
  'x-forwarded-for': FORWARDED_FOR,
  'x-forwarded-host': FORWARDED_HOST,
  'x-forwarded-proto': 'https',
});

export { FORWARDED_HOST, NOSNIFF, forwarded, securityHookOf };
export type { SecurityHook, SecurityResponse };
