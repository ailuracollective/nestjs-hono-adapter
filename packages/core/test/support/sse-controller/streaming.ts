import { Controller, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

const TICK_INTERVAL = 10;

const FLOOD_FRAMES = 64;

const torn = new Subject<void>();

@Controller()
class StreamingController {
  @Sse('sse/flood')
  public flood(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      for (let count = 0; count < FLOOD_FRAMES; count += 1) {
        subscriber.next({ data: { count } });
      }
      subscriber.complete();
    });
  }

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
