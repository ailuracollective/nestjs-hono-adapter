import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class TokenGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-api-token'] === 'let-me-in') {
      return true;
    }
    throw new UnauthorizedException('x-api-token is missing or wrong');
  }
}