/** The adapters whose multipart bodies the island owns. */
const adaptersWithUploads = new WeakSet<object>();

/** Marks an adapter whose bodies the upload island owns. */
const declareMultipart = (adapter: object): void => {
  adaptersWithUploads.add(adapter);
};

/** Whether the upload island owns this adapter's bodies. */
const parsesMultipart = (adapter: object): boolean =>
  adaptersWithUploads.has(adapter);

export { declareMultipart, parsesMultipart };
