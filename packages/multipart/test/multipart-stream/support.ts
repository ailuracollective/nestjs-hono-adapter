import { request, startProbe } from '#test/probe';
import { ABORT_DEADLINE } from '#multipart-test/multipart.support/constants';
import { withDeadline } from '#multipart-test/multipart.support/requests';
import { BOUNDARY, PADDING } from './constants.ts';
import { StreamModule } from './controller.ts';

interface PacedBody {
  readonly body: ReadableStream<Uint8Array>;
  readonly finished: () => boolean;
}

const pacedBody = (count: number, size: number): PacedBody => {
  const encoder = new TextEncoder();
  const head =
    `--${BOUNDARY}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="big.txt"\r\n' +
    'Content-Type: text/plain\r\n\r\n';
  const pieces: Uint8Array[] = [encoder.encode(head)];
  for (let index = 0; index < count; index += 1) {
    pieces.push(new Uint8Array(size).fill(PADDING));
  }
  pieces.push(encoder.encode(`\r\n--${BOUNDARY}--\r\n`));
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller): void {
      const piece = pieces[pulled];
      if (piece === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(piece);
      pulled += 1;
    },
  });
  return { body, finished: () => pulled >= pieces.length };
};

const app = (): ReturnType<typeof startProbe> =>
  startProbe({
    mode: 'in-process',
    module: StreamModule,
  });

const send = async (
  route: string,
  form: FormData,
): Promise<Awaited<ReturnType<typeof request>>> => {
  const probe = await app();
  try {
    return await request(probe, route, {
      body: form,
      method: 'POST',
    });
  } finally {
    await probe.close();
  }
};

const sendBody = async (
  route: string,
  init: RequestInit & { duplex?: string },
): Promise<Awaited<ReturnType<typeof request>> | 'hung'> => {
  const probe = await app();
  try {
    return await withDeadline(request(probe, route, init), ABORT_DEADLINE);
  } finally {
    await probe.close();
  }
};

const pacedInit = (paced: PacedBody): RequestInit & { duplex?: string } => ({
  body: paced.body,
  duplex: 'half',
  headers: {
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
  },
  method: 'POST',
});

const answered = <Value>(outcome: Value | 'hung', what: string): Value => {
  if (outcome === 'hung') {
    throw new Error(`the ${what} never answered`);
  }
  return outcome;
};

export { answered, app, pacedBody, pacedInit, send, sendBody };
