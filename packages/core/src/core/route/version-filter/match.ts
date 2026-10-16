import { VERSION_NEUTRAL } from '@nestjs/common';

type VersionValue = string | typeof VERSION_NEUTRAL | (string | typeof VERSION_NEUTRAL)[];

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

export { isNeutral, matchesVersion, toVersionList };
export type { VersionValue };
