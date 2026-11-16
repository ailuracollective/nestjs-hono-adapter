interface InertiaRequestShape {
  readonly method: string;
  readonly originalUrl: string;
  header: (name: string) => string | undefined;
}

interface InertiaResponseShape {
  readonly raw: unknown;
  status: (code: number) => InertiaResponseShape;
  setHeader: (name: string, value: string) => InertiaResponseShape;
  end: () => void;
}

interface InertiaServiceShape {
  readonly req: InertiaRequestShape;
  readonly res: InertiaResponseShape;
  readonly deps: { readonly assetVersion: string };
}

interface ServicePeer {
  readonly InertiaService: { readonly prototype: unknown };
}

const firstHeader = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const [first] = value.split(',');
  return first === undefined ? undefined : first.trim();
};

const fullUrl = (req: InertiaRequestShape): string => {
  const proto = firstHeader(req.header('x-forwarded-proto')) ?? 'http';
  const host = firstHeader(req.header('host')) ?? 'localhost';
  return new URL(req.originalUrl, `${proto}://${host}`).toString();
};

const isHonoResponse = (res: InertiaResponseShape): boolean =>
  typeof res.raw === 'object' &&
  res.raw !== null &&
  typeof Reflect.get(res.raw, 'finalized') === 'boolean';

export { firstHeader, fullUrl, isHonoResponse };
export type { InertiaRequestShape, InertiaResponseShape, InertiaServiceShape, ServicePeer };
