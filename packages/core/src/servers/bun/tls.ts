import type { NestApplicationOptions } from '@nestjs/common';

/** What Nest allows as TLS options. */
type HttpsOptions = NonNullable<
  NestApplicationOptions['httpsOptions']
>;

/** The Node TLS options Bun understands, by name. */
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

/** Maps the Node TLS options a deployment named onto Bun's. */
const toBunTls = (
  certificate: HttpsOptions,
): Record<string, unknown> => {
  const tls: Record<string, unknown> = {};
  for (const name of TLS_FIELDS) {
    const value = certificate[name] as unknown;
    if (value !== undefined) {
      tls[name] = value;
    }
  }
  return tls;
};

/** The TLS options Bun is started with, when there are any. */
const tlsOf = (
  certificate: HttpsOptions | undefined,
): Record<string, unknown> | undefined => {
  if (certificate === undefined) {
    return undefined;
  }
  return toBunTls(certificate);
};

export { toBunTls, tlsOf };
export type { HttpsOptions };
