import type { CanActivate } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

/** A pass-through guard that allows every request. */
@Injectable()
export class BenchGuard implements CanActivate {
  /**
   * Evaluates whether the request is allowed.
   *
   * @returns Always returns true to allow traffic.
   */
  public canActivate(): boolean {
    return true;
  }
}
