import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

/** Refuses a request without the example API token. */
@Injectable()
export class TokenGuard implements CanActivate {
  /** Allows the request when `x-api-token` matches. */
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-api-token'] === 'let-me-in') {
      return true;
    }
    throw new UnauthorizedException('x-api-token is missing or wrong');
  }
}
