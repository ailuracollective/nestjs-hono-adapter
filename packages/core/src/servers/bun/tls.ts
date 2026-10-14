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

const tlsOf = (certificate: HttpsOptions | undefined): Record<string, unknown> | undefined => {
  if (certificate === undefined) return undefined;
  return toBunTls(certificate);
};

export { toBunTls, tlsOf };
export type { HttpsOptions };
