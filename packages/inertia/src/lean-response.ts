import type { NestContext } from '@ailura/nestjs-hono-adapter';

const OK = 200;

interface FittedResponse {
  readonly getHeader: (name: string) => string | readonly string[] | undefined;
  readonly headersSent?: boolean;
  readonly json: (body: unknown) => unknown;
  readonly send: (body?: unknown) => unknown;
  readonly setHeader: (name: string, value: string) => unknown;
  readonly status: (code: number) => unknown;
  readonly statusCode?: number;
}

interface StreamSink {
  readonly end: (chunk?: unknown) => void;
  readonly write: (chunk: unknown) => boolean;
}

interface InertiaResponse {
  readonly end: () => void;
  readonly getHeader: (name: string) => string | readonly string[] | undefined;
  readonly headersSent: boolean;
  readonly html: (body: string) => void;
  readonly htmlStream: (initialChunk: unknown) => StreamSink;
  readonly json: (body: unknown, serialized?: string) => void;
  readonly raw: NestContext;
  readonly setHeader: (name: string, value: string) => InertiaResponse;
  readonly status: (code: number) => InertiaResponse;
  readonly statusCode: number;
}

// Hono answers with a buffered response, so the stream collects its chunks and sends them once.
const toBytes = (chunk: unknown): Uint8Array => {
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  if (chunk instanceof Uint8Array) return chunk;
  return new TextEncoder().encode(String(chunk));
};
const streamOf = (fitted: FittedResponse): StreamSink => {
  const chunks: Uint8Array[] = [];
  return {
    end(chunk?: unknown): void {
      if (chunk !== undefined) chunks.push(toBytes(chunk));
      const decoder = new TextDecoder();
      let text = '';
      for (const part of chunks) text += decoder.decode(part, { stream: true });
      text += decoder.decode();
      fitted.send(text);
    },
    write(chunk: unknown): boolean {
      chunks.push(toBytes(chunk));
      return true;
    },
  };
};
const adaptResponse = (context: NestContext): InertiaResponse => {
  // The bridge's surface fit adds these members before the route runs (see surface.ts).
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fitted context carries the Express response members.
  const fitted = context as unknown as FittedResponse;
  const wrapper: InertiaResponse = {
    end(): void {
      // `send` resolves the pending status; the bridge's `end` reads its own status symbol.
      fitted.send();
    },
    getHeader(name: string): string | readonly string[] | undefined {
      return fitted.getHeader(name);
    },
    get headersSent(): boolean {
      return fitted.headersSent === true;
    },
    html(body: string): void {
      fitted.setHeader('Content-Type', 'text/html; charset=utf-8');
      fitted.send(body);
    },
    htmlStream(initialChunk: unknown): StreamSink {
      fitted.setHeader('Content-Type', 'text/html; charset=utf-8');
      const sink = streamOf(fitted);
      sink.write(initialChunk);
      return sink;
    },
    json(body: unknown, serialized?: string): void {
      fitted.setHeader('Content-Type', 'application/json');
      fitted.send(serialized ?? JSON.stringify(body));
    },
    raw: context,
    setHeader(name: string, value: string): InertiaResponse {
      fitted.setHeader(name, value);
      return wrapper;
    },
    status(code: number): InertiaResponse {
      fitted.status(code);
      return wrapper;
    },
    get statusCode(): number {
      return fitted.statusCode ?? OK;
    },
  };
  return wrapper;
};
export { adaptResponse };
