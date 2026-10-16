import type { AllowedOrigins, OriginCallback } from '#adapter/features/cors/types';

const matchesRule = (origin: string, rule: string | RegExp): boolean => {
  if (rule instanceof RegExp) return rule.test(origin);

  return rule === origin;
};

const isAllowedOrigin = (origin: string, allowed: AllowedOrigins | undefined): boolean => {
  if (origin === '' || allowed === false || allowed === undefined) return false;

  if (allowed === true) return true;

  if (typeof allowed === 'string') return allowed === '*' || allowed === origin;

  if (allowed instanceof RegExp) return allowed.test(origin);

  return allowed.some((candidate) => matchesRule(origin, candidate));
};

const allowedOrigin =
  (allowed: AllowedOrigins | undefined): ((origin: string) => string | undefined) =>
  (origin: string): string | undefined => {
    if (isAllowedOrigin(origin, allowed)) {
      return origin;
    }

    return undefined;
  };

const staticOrigin = (
  origin: AllowedOrigins | OriginCallback | undefined,
): AllowedOrigins | undefined => {
  if (typeof origin === 'function') return undefined;

  return origin;
};

export { allowedOrigin, staticOrigin };
