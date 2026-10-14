import { Injectable, Module } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';

const GATEWAY_PATH = '/ws';

const PING = 'ping';

const FACTOR = 2;

const INPUT = 3;

const DOUBLED = INPUT * FACTOR;

const ANSWER = { data: { doubled: DOUBLED }, event: PING };

const OTHER_PATH = '/other';

const SOCKET = 'socket';

const FAIL = 'fail';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

@Injectable()
@WebSocketGateway({ path: GATEWAY_PATH })
class PingGateway {
  @SubscribeMessage(PING)
  public ping(@MessageBody() data: { readonly amount: number }): { readonly doubled: number } {
    return { doubled: data.amount * FACTOR };
  }

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

  @SubscribeMessage(FAIL)
  public fail(): never {
    throw new WsException('the fixture was asked to fail');
  }
}

@Injectable()
@WebSocketGateway({ path: OTHER_PATH })
class OtherGateway {
  @SubscribeMessage(PING)
  public ping(): { readonly path: string } {
    return { path: OTHER_PATH };
  }
}

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
