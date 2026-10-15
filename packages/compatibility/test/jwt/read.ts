const isObject = (body: unknown): body is Record<PropertyKey, unknown> =>
  typeof body === 'object' && body !== null;

const bearerOf = (header: unknown): string | undefined => {
  if (typeof header !== 'string') return undefined;
  return header.replace('Bearer ', '');
};

const objectOf = (body: unknown): Record<PropertyKey, unknown> => {
  if (!isObject(body)) {
    return {};
  }
  return body;
};

const subjectOf = (user: unknown): string => {
  if (!isObject(user)) {
    return 'nobody';
  }
  const sub: unknown = Reflect.get(user, 'sub');
  if (typeof sub !== 'string') return 'nobody';
  return sub;
};

export { bearerOf, objectOf, subjectOf };
