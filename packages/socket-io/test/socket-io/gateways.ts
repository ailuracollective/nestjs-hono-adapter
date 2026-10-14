import { Module } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/** The namespace the second gateway answers on. */
const ADMIN = '/admin';

/** The room the broadcast case joins. */
const ROOM = 'room1';

/** The greeting the room case hears. */
const GREETING = `hello ${ROOM}`;

/** The event the fixture echoes. */
const PING = 'ping';

/** The event that joins a room. */
const JOIN = 'join';

/** The event answered on an event of its own. */
const SHOUT = 'shout';

/** The event a room broadcast is sent on. */
const BROADCAST = 'broadcast';

/** The event the shout handler answers on. */
const SHOUTED = 'shouted';

/** The clients a gateway saw go away. */
const gone: string[] = [];

/** The gateway that echoes, joins rooms and shouts. */
@WebSocketGateway()
class EchoGateway implements OnGatewayDisconnect {
  /** The socket.io server. */
  @WebSocketServer() public server!: Server;

  /** Echoes the payload back. */
  @SubscribeMessage(PING)
  public onPing(@MessageBody() data: unknown): unknown {
    return { echo: data };
  }

  /** Joins the room and greets it. */
  @SubscribeMessage(JOIN)
  public async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ): Promise<string> {
    await client.join(room);
    this.server.to(room).emit(BROADCAST, GREETING);
    return 'joined';
  }

  /** Answers on an event of its own. */
  @SubscribeMessage(SHOUT)
  public onShout(@MessageBody() text: string): {
    data: string;
    event: string;
  } {
    return { data: text, event: SHOUTED };
  }

  /** Records the client that went away. */
  public handleDisconnect(client: Socket): void {
    gone.push(client.id);
  }
}

/** The gateway that answers on the admin namespace. */
@WebSocketGateway({ namespace: ADMIN })
class AdminGateway {
  /** Answers the namespace name. */
  @SubscribeMessage('who')
  public onWho(): string {
    return 'admin';
  }
}

/** The module that registers both gateways. */
@Module({ providers: [AdminGateway, EchoGateway] })
class GatewayModule {}

export {
  ADMIN,
  BROADCAST,
  GREETING,
  GatewayModule,
  JOIN,
  PING,
  ROOM,
  SHOUT,
  SHOUTED,
  gone,
};
