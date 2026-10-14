/** The status a created upload answers with. */
const CREATED = 201;
/** The status a refused body answers with. */
const BAD_REQUEST = 400;
/** The status an over-limit upload answers with. */
const TOO_LARGE = 413;

/** The file size ceiling one route sets. */
const CAPPED = 2048;
/** How many pieces a body over the ceiling arrives in. */
const SMALL_PIECES = 64;
/** How large each of those pieces is. */
const SMALL_PIECE = 512;

/** What the route that answers with a file of its own sends. */
const ELSEWHERE = 'elsewhere';

/** The boundary every body built here is cut with. */
const BOUNDARY = 'stream-boundary';

/** The byte the padding of an unread upload is made of. */
const PADDING = 120;

/** How many pieces a staged body is made of. */
const PIECES = 24;
/** How large each piece is. */
const PIECE = 8192;

export {
  BAD_REQUEST,
  BOUNDARY,
  CAPPED,
  CREATED,
  ELSEWHERE,
  PADDING,
  PIECE,
  PIECES,
  SMALL_PIECE,
  SMALL_PIECES,
  TOO_LARGE,
};
