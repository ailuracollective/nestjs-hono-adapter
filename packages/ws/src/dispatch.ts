import type { Logger, WsMessageHandler } from '@nestjs/common';
import { EMPTY } from 'rxjs';
import type { Observable } from 'rxjs';
import { catchError, filter, map } from 'rxjs/operators';

import { isReply, readFrame, toReply } from './client/index.ts';
import type { MessageParser, WsFrame } from './client/index.ts';

/**
 * Turns the frames of one client into the answers of its
 * handlers.
 */
class Dispatcher {
  /** Reads the frames every gateway receives. */
  private readonly parser: MessageParser;
  /** Reports failures from the gateways and their sockets. */
  private readonly logger: Logger;

  /**
   * Reads frames with the parser and reports through the
   * logger.
   */
  public constructor(parser: MessageParser, logger: Logger) {
    this.parser = parser;
    this.logger = logger;
  }

  /** Answers one frame, when a handler claims its event. */
  public answer(
    raw: unknown,
    byEvent: ReadonlyMap<string, WsMessageHandler>,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    const frame = readFrame(raw, this.parser, this.logger);
    if (frame === undefined) {
      return EMPTY;
    }
    const handler = byEvent.get(frame.event);
    if (handler === undefined) {
      return EMPTY;
    }
    return this.invoke(handler, frame, transform);
  }

  /** Runs one handler and turns its answer into frames. */
  private invoke(
    handler: WsMessageHandler,
    frame: WsFrame,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    try {
      return this.replies(
        transform(handler.callback(frame.data)),
        frame,
      );
    } catch (error) {
      return this.report(error);
    }
  }

  /** The frames one handler's stream answers with. */
  private replies(
    stream: Observable<unknown>,
    frame: WsFrame,
  ): Observable<unknown> {
    return stream.pipe(
      map((value) => toReply(frame, value)),
      filter(isReply),
      catchError((error: unknown) => this.report(error)),
    );
  }

  /** Reports a handler that failed and answers nothing. */
  private report(error: unknown): Observable<never> {
    this.logger.error(error);
    return EMPTY;
  }
}

export { Dispatcher };
