import { Injectable, Module } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';

/** The path the gateway fixture listens on. */
const GATEWAY_PATH = '/ws';

/** The event the gateway fixture answers. */
const PING = 'ping';

/** The factor the gateway fixture answers with. */
const FACTOR = 2;

/** The payload the fixture is asked with. */
const INPUT = 3;

/** What the fixture answers when it is asked with INPUT. */
const DOUBLED = INPUT * FACTOR;

/** The frame the fixture answers an uncorrelated ask with. */
const ANSWER = { data: { doubled: DOUBLED }, event: PING };

/** The other path a gateway fixture listens on. */
const OTHER_PATH = '/other';

/** The event the fixture reports the socket it was given on. */
const SOCKET = 'socket';

/** The event the fixture throws on. */
const FAIL = 'fail';

/** Narrows what a gateway was handed to the object it is. */
const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A gateway with one event, answering with a value. */
@Injectable()
@WebSocketGateway({ path: GATEWAY_PATH })
class PingGateway {
  /** Doubles the amount it is sent. */
  @SubscribeMessage(PING)
  public ping(
    @MessageBody() data: { readonly amount: number },
  ): { readonly doubled: number } {
    return { doubled: data.amount * FACTOR };
  }

  /** Reports what the socket it was given can do. */
  @SubscribeMessage(SOCKET)
  public socket(@ConnectedSocket() socket: unknown): unknown {
    if (!isRecord(socket)) {
      throw new TypeError('the socket was not an object');
    }
    return {
      close: typeof socket.close,
      on: typeof socket.on,
      once: typeof socket.once,
      readyState: socket.readyState,
      send: typeof socket.send,
    };
  }

  /** Throws the fixture's exception. */
  @SubscribeMessage(FAIL)
  public fail(): never {
    throw new WsException('the fixture was asked to fail');
  }
}

/** A second gateway, answering on a path of its own. */
@Injectable()
@WebSocketGateway({ path: OTHER_PATH })
class OtherGateway {
  /** Reports the path it answers on. */
  @SubscribeMessage(PING)
  public ping(): { readonly path: string } {
    return { path: OTHER_PATH };
  }
}

/** The module that registers both gateways. */
@Module({ providers: [PingGateway, OtherGateway] })
class GatewayModule {}

export {
  ANSWER,
  DOUBLED,
  FAIL,
  FACTOR,
  GATEWAY_PATH,
  GatewayModule,
  INPUT,
  OTHER_PATH,
  PING,
  SOCKET,
  isRecord,
};
