import { VERSION_NEUTRAL } from '@nestjs/common';

import type { NestRequest } from '#adapter/core/request/request';

type VersionValue = string | typeof VERSION_NEUTRAL | (string | typeof VERSION_NEUTRAL)[];

const readHeader = (request: NestRequest, name: string): string | undefined =>
  request.headers[name] ?? request.headers[name.toLowerCase()];

const isNeutral = (version: VersionValue): boolean =>
  Array.isArray(version) && version.includes(VERSION_NEUTRAL);

const toVersionList = (value: string | VersionValue): (string | symbol)[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
};

const matchesVersion = (
  version: VersionValue,
  supplied: string | string[] | undefined,
): boolean => {
  if (supplied === undefined) return false;
  const suppliedVersions = toVersionList(supplied);
  const acceptedVersions = toVersionList(version);
  return acceptedVersions.some((accepted) => suppliedVersions.includes(accepted));
};

export { isNeutral, matchesVersion, readHeader, toVersionList };
export type { VersionValue };
