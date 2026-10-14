import { HttpStatus } from '@nestjs/common';

import type { FetchHostWebSocket } from '#adapter/servers/fetch';

const OPEN_STATE = 1;

const DOUBLING = 2;

const INPUT = 3;

class DrivenSocket {
  public readonly sent: string[] = [];
  public readonly readyState: number = OPEN_STATE;

  public close(): void {
    // The case drives the frames.
  }

  public send(data: string): void {
    this.sent.push(data);
  }
}

class DrivenHost {
  public deliver: ((data: unknown) => void) | undefined = undefined;
  private readonly socket = new DrivenSocket();

  public readonly helper: FetchHostWebSocket = (createEvents) => (context) => {
    const { onMessage } = createEvents(context);
    this.deliver = (data): void => {
      if (onMessage === undefined) return;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a driven socket is not a WSContext.
      onMessage({ data }, this.socket as never);
    };
    return Promise.resolve(
      new Response(undefined, {
        status: HttpStatus.SWITCHING_PROTOCOLS,
      }),
    );
  };

  public frames(): unknown[] {
    return this.socket.sent.map((frame): unknown => JSON.parse(frame) as unknown);
  }
}

export { DOUBLING, DrivenHost, INPUT, OPEN_STATE };
