import type { Logger, WsMessageHandler } from '@nestjs/common';
import { EMPTY } from 'rxjs';
import type { Observable } from 'rxjs';
import { catchError, filter, map } from 'rxjs/operators';

import { isReply, readFrame, toReply } from './client/index.ts';
import type { MessageParser, WsFrame } from './client/index.ts';

class Dispatcher {
  private readonly parser: MessageParser;
  private readonly logger: Logger;

  public constructor(parser: MessageParser, logger: Logger) {
    this.parser = parser;
    this.logger = logger;
  }

  public answer(
    raw: unknown,
    byEvent: ReadonlyMap<string, WsMessageHandler>,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    const frame = readFrame(raw, this.parser, this.logger);
    if (frame === undefined) return EMPTY;
    const handler = byEvent.get(frame.event);
    if (handler === undefined) return EMPTY;
    return this.invoke(handler, frame, transform);
  }

  private invoke(
    handler: WsMessageHandler,
    frame: WsFrame,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    try {
      return this.replies(transform(handler.callback(frame.data)), frame);
    } catch (error) {
      return this.report(error);
    }
  }

  private replies(stream: Observable<unknown>, frame: WsFrame): Observable<unknown> {
    return stream.pipe(
      map((value) => toReply(frame, value)),
      filter(isReply),
      catchError((error: unknown) => this.report(error)),
    );
  }

  private report(error: unknown): Observable<never> {
    this.logger.error(error);
    return EMPTY;
  }
}

export { Dispatcher };
