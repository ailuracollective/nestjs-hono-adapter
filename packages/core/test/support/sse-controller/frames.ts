import { Controller, ForbiddenException, Header, HttpCode, HttpStatus, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';

const SECOND_FRAME_DELAY = 300;

@Controller()
class FramesController {
  @Sse('sse/slow')
  public slow(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'first' });
      const timer = setTimeout(() => {
        subscriber.next({ data: 'second' });
        subscriber.complete();
      }, SECOND_FRAME_DELAY);
      return (): void => {
        clearTimeout(timer);
      };
    });
  }

  @Sse('sse/frames')
  @Header('x-stream', 'yes')
  public frames(): Observable<MessageEvent> {
    return of({
      data: { count: 1 },
      id: 'two',
      retry: 3000,
      type: 'tick',
    });
  }

  @Sse('sse/promise')
  public promised(): Promise<Observable<MessageEvent>> {
    return Promise.resolve(of({ data: 'deferred' }));
  }

  @Sse('sse/throws')
  public throws(): Observable<MessageEvent> {
    throw new ForbiddenException('no stream');
  }

  @Sse('sse/errors')
  public errors(): Observable<MessageEvent> {
    return throwError(() => new Error('stream failed'));
  }

  @Sse('sse/broken')
  public broken(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'open' });
      subscriber.error(new Error('after the frame'));
    });
  }

  @Sse('sse/decorated')
  @Header('x-stream', 'yes')
  @HttpCode(HttpStatus.ACCEPTED)
  public decorated(): Observable<MessageEvent> {
    return of({ data: 'decorated' });
  }
}

export { FramesController, SECOND_FRAME_DELAY };
