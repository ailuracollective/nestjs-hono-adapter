interface InertiaRequestShape {
  readonly method: string;
  readonly originalUrl: string;
  readonly protocol: string;
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

const isHonoResponse = (res: InertiaResponseShape): boolean =>
  typeof res.raw === 'object' &&
  res.raw !== null &&
  typeof Reflect.get(res.raw, 'finalized') === 'boolean';

export { isHonoResponse };
export type { InertiaRequestShape, InertiaResponseShape, InertiaServiceShape, ServicePeer };
