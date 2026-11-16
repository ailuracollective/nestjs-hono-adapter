interface RedirectResponse {
  readonly finalized: boolean;
  statusCode: number;
  redirect?: (statusOrUrl: number | string, url?: string | number) => unknown;
}

const stringOf = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') return entry;
    }
    return undefined;
  }
  return typeof value === 'string' ? value : undefined;
};

const headerOf = (req: unknown, name: string): string | undefined => {
  if (typeof req !== 'object' || req === null) return undefined;
  const header: unknown = Reflect.get(req, 'header');
  if (typeof header === 'function') return stringOf(Reflect.apply(header, req, [name]));
  const headers: unknown = Reflect.get(req, 'headers');
  if (typeof headers !== 'object' || headers === null) return undefined;
  return stringOf(Reflect.get(headers, name.toLowerCase()));
};

const methodOf = (req: unknown): string => {
  if (typeof req !== 'object' || req === null) return '';
  const method: unknown = Reflect.get(req, 'method');
  return typeof method === 'string' ? method : '';
};

const isHono = (res: unknown): res is RedirectResponse =>
  typeof res === 'object' && res !== null && typeof Reflect.get(res, 'finalized') === 'boolean';

export { headerOf, isHono, methodOf };
export type { RedirectResponse };
