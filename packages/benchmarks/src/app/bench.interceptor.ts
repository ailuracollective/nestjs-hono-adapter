import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';

/** A pass-through interceptor that records no work. */
@Injectable()
export class BenchInterceptor implements NestInterceptor {
  /**
   * Intercepts route handling and passes it through directly.
   *
   * @param _context - The execution context of the request.
   * @param next - The call handler to invoke next.
   * @returns An observable of the response stream.
   */
  public intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle();
  }
}
