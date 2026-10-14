import { VERSION_NEUTRAL } from '@nestjs/common';

import type { NestRequest } from '#adapter/core/request/request';

/** A route version, or a list of them. */
type VersionValue =
  | string
  | typeof VERSION_NEUTRAL
  | (string | typeof VERSION_NEUTRAL)[];

/** Reads one request header by name. */
const readHeader = (
  request: NestRequest,
  name: string,
): string | undefined =>
  request.headers[name] ?? request.headers[name.toLowerCase()];

/** Whether a version is the neutral marker. */
const isNeutral = (version: VersionValue): boolean =>
  Array.isArray(version) && version.includes(VERSION_NEUTRAL);

/** Normalises a version, or a list of them, into a list. */
const toVersionList = (
  value: string | VersionValue,
): (string | symbol)[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
};

/** Whether a supplied version is one of the accepted ones. */
const matchesVersion = (
  version: VersionValue,
  supplied: string | string[] | undefined,
): boolean => {
  if (supplied === undefined) {
    return false;
  }
  const suppliedVersions = toVersionList(supplied);
  const acceptedVersions = toVersionList(version);
  return acceptedVersions.some((accepted) =>
    suppliedVersions.includes(accepted),
  );
};

export { isNeutral, matchesVersion, readHeader, toVersionList };
export type { VersionValue };
