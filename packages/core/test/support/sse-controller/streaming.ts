import { Controller, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** How often the open route ticks while the client listens. */
const TICK_INTERVAL = 10;

/** How many frames the flood route writes with no pause. */
const FLOOD_FRAMES = 64;

/** Says when the open route was torn down. */
const torn = new Subject<void>();

/** The event-stream routes that stay open. */
@Controller()
class StreamingController {
  /** Writes more frames than a stream holds. */
  @Sse('sse/flood')
  public flood(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      for (let count = 0; count < FLOOD_FRAMES; count += 1) {
        subscriber.next({ data: { count } });
      }
      subscriber.complete();
    });
  }

  /** Answers frames until the client leaves. */
  @Sse('sse/open')
  public open(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'open' });
      const timer = setInterval(() => {
        subscriber.next({ data: 'tick' });
      }, TICK_INTERVAL);
      return (): void => {
        torn.next();
        clearInterval(timer);
      };
    });
  }
}

export { FLOOD_FRAMES, StreamingController, torn };
