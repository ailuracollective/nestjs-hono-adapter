import type { NestApplicationOptions } from '@nestjs/common';

type HttpsOptions = NonNullable<NestApplicationOptions['httpsOptions']>;

const TLS_FIELDS = [
  'key',
  'cert',
  'ca',
  'passphrase',
  'ciphers',
  'secureOptions',
  'requestCert',
  'rejectUnauthorized',
] as const;

const toBunTls = (certificate: HttpsOptions): Record<string, unknown> => {
  const tls: Record<string, unknown> = {};
  for (const name of TLS_FIELDS) {
    const value = certificate[name] as unknown;
    if (value !== undefined) tls[name] = value;
  }
  return tls;
};

// Bun serves plain HTTP for a `tls` object it cannot use, so a certificate without key material is
// refused here rather than answered in the clear. `pfx` is the case that matters: Bun reads none.
const tlsOf = (certificate?: HttpsOptions): Record<string, unknown> | undefined => {
  if (certificate === undefined) return undefined;
  const tls = toBunTls(certificate);
  if (tls.key === undefined || tls.cert === undefined) {
    throw new TypeError('httpsOptions must carry a key and a cert');
  }
  return tls;
};

export { toBunTls, tlsOf };
export type { HttpsOptions };
