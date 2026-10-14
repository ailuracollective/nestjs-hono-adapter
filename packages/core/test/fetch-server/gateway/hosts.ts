import { HttpStatus } from '@nestjs/common';

import type { FetchHostWebSocket } from '#adapter/servers/fetch';

/** The state a socket is in once it accepts a send. */
const OPEN_STATE = 1;

/** What the gateway fixture multiplies by. */
const DOUBLING = 2;

/** What the gateway fixture is asked with. */
const INPUT = 3;

/** A socket a host helper drives. */
class DrivenSocket {
  /** The frames the socket was sent. */
  public readonly sent: string[] = [];
  /** The ready state the socket reports. */
  public readonly readyState: number = OPEN_STATE;

  /** Closes the socket. */
  public close(): void {
    // The case drives the frames.
  }

  /** Records a frame the socket was sent. */
  public send(data: string): void {
    this.sent.push(data);
  }
}

/** A host helper that keeps the event the factory handed it. */
class DrivenHost {
  /** Delivers a frame to the gateway's handler. */
  public deliver: ((data: unknown) => void) | undefined =
    undefined;
  /** The socket the helper answers through. */
  private readonly socket = new DrivenSocket();

  /** The helper the transport is given. */
  public readonly helper: FetchHostWebSocket =
    (createEvents) => (context) => {
      const { onMessage } = createEvents(context);
      this.deliver = (data): void => {
        if (onMessage === undefined) {
          return;
        }
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a driven socket is not a WSContext.
        onMessage({ data }, this.socket as never);
      };
      return Promise.resolve(
        new Response(undefined, {
          status: HttpStatus.SWITCHING_PROTOCOLS,
        }),
      );
    };

  /** The frames the gateway answered with, parsed. */
  public frames(): unknown[] {
    return this.socket.sent.map(
      (frame): unknown => JSON.parse(frame) as unknown,
    );
  }
}

/** A gateway fixture, served through the host helper. */

export { DOUBLING, DrivenHost, INPUT, OPEN_STATE };
