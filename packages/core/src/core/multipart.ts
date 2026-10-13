/**
 * The seam that hands a multipart body to the upload island.
 *
 * The request path parses every body on demand, and a
 * `multipart/form-data` body with it — but the upload island
 * wants the stream itself, so it can shape the parts the way
 * multer shapes them and enforce a file's ceiling while it is
 * written. It is opt-in and lives behind `./multipart`;
 * importing it marks the adapter, and a marked adapter leaves a
 * multipart body alone so an interceptor can consume it.
 *
 * The mark is held beside the adapter rather than on it, so
 * nothing in the request path has to grow an optional member
 * the island would fill in, and an adapter that serves no
 * upload carries no trace of the island at all.
 */
const adaptersWithUploads = new WeakSet<object>();

/**
 * Records that this adapter lets the upload island consume a
 * body.
 */
function declareMultipart(adapter: object): void {
  adaptersWithUploads.add(adapter);
}

/**
 * Says whether the upload island owns this adapter's multipart
 * bodies.
 */
function parsesMultipart(adapter: object): boolean {
  return adaptersWithUploads.has(adapter);
}

export { declareMultipart, parsesMultipart };
