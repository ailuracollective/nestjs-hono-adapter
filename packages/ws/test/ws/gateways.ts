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

interface Frame {
  readonly data: unknown;
  readonly event: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

@Injectable()
@WebSocketGateway({ path: GATEWAY_PATH })
class PingGateway {
  @SubscribeMessage(PING)
  public ping(@MessageBody() data: { readonly amount: number }): Frame {
    return { data: { doubled: data.amount * FACTOR }, event: PING };
  }

  @SubscribeMessage(SOCKET)
  public socket(@ConnectedSocket() socket: unknown): Frame {
    if (!isRecord(socket)) {
      throw new TypeError('the socket was not an object');
    }
    return {
      data: {
        close: typeof socket.close,
        on: typeof socket.on,
        once: typeof socket.once,
        readyState: socket.readyState,
        send: typeof socket.send,
      },
      event: SOCKET,
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
  public ping(): Frame {
    return { data: { path: OTHER_PATH }, event: PING };
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
export type { Frame };
