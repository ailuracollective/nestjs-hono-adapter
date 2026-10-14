/** Whether a value is an object a key can be read out of. */
const isObject = (
  body: unknown,
): body is Record<PropertyKey, unknown> =>
  typeof body === 'object' && body !== null;

/** The token a `Bearer` header carries, or `undefined`. */
const bearerOf = (header: unknown): string | undefined => {
  if (typeof header !== 'string') {
    return undefined;
  }
  return header.replace('Bearer ', '');
};

/** The body as an object, whatever arrived. */
const objectOf = (
  body: unknown,
): Record<PropertyKey, unknown> => {
  if (!isObject(body)) {
    return {};
  }
  return body;
};

/** The subject a guard resolved from the request. */
const subjectOf = (user: unknown): string => {
  if (!isObject(user)) {
    return 'nobody';
  }
  const sub: unknown = Reflect.get(user, 'sub');
  if (typeof sub !== 'string') {
    return 'nobody';
  }
  return sub;
};

export { bearerOf, objectOf, subjectOf };
