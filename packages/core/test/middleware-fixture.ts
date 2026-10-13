import 'reflect-metadata';

import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  RequestMethod,
} from '@nestjs/common';
import type {
  MiddlewareConsumer,
  NestMiddleware,
  NestModule,
} from '@nestjs/common';

import type {
  NestContext,
  NestRequest,
  NextHandler,
} from '../src/index.ts';

/**
 * The fixtures that mount Nest middleware, which lives in its
 * own module file because it has grown past what the shared
 * fixture file may hold: `./support.ts` keeps the controller
 * the other cases share, and the routes a middleware case needs
 * are about mounting rather than about the bridge.
 */

/** The header the marker middleware leaves on its answer. */
const MIDDLEWARE_HEADER = 'x-middleware';

/** What the marker middleware puts there. */
const MIDDLEWARE_MARK = 'ran';

/**
 * Middleware that marks every request that passed through it,
 * which is how a case tells a mounted middleware from an
 * unmounted one.
 */
@Injectable()
class MarkerMiddleware implements NestMiddleware {
  public use(
    _request: NestRequest,
    response: NestContext,
    next: NextHandler,
  ): void {
    response.header(MIDDLEWARE_HEADER, MIDDLEWARE_MARK);
    next();
  }
}

/**
 * A controller under a prefix, so a case can tell middleware
 * mounted on a prefix from middleware that answers every path.
 */
@Controller('api')
class ApiController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  @Post('ping')
  public pingBack(@Body() body: unknown): unknown {
    return body;
  }
}

/**
 * The routes the middleware cases answer. The two live at the
 * root and under a prefix, which is the difference between
 * middleware mounted on one and middleware mounted on the
 * other.
 */
@Controller()
class RootController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }
}

/** A module whose middleware answers every path. */
@Module({ controllers: [RootController, ApiController] })
class GlobalMiddlewareModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes('*');
  }
}

/**
 * A module whose middleware answers the prefix and what is
 * under it.
 */
@Module({ controllers: [RootController, ApiController] })
class PrefixedMiddlewareModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes('api');
  }
}

/** A module whose middleware answers one method of one path. */
@Module({ controllers: [ApiController] })
class MethodMiddlewareModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes({
      method: RequestMethod.POST,
      path: 'api/ping',
    });
  }
}

export {
  GlobalMiddlewareModule,
  MIDDLEWARE_HEADER,
  MIDDLEWARE_MARK,
  MethodMiddlewareModule,
  PrefixedMiddlewareModule,
};
