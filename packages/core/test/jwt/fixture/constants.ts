/** The secret the module signs with. */
const SECRET = 'a-secret-only-the-fixture-knows';

/** The subject a token carries. */
const SUBJECT = 'hono-adapter';

/** The header the guard reads its token from. */
const BEARER = 'authorization';

/** The lifetime a forged token claims, in seconds. */
const FORGED_LIFETIME = 600;

/** The unit a token's expiry is written in. */
const MILLISECONDS_PER_SECOND = 1000;

export {
  BEARER,
  FORGED_LIFETIME,
  MILLISECONDS_PER_SECOND,
  SECRET,
  SUBJECT,
};
