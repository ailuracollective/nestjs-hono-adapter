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

const ADMIN = '/admin';

const ROOM = 'room1';

const GREETING = `hello ${ROOM}`;

const PING = 'ping';

const JOIN = 'join';

const SHOUT = 'shout';

const BROADCAST = 'broadcast';

const SHOUTED = 'shouted';

const gone: string[] = [];

@WebSocketGateway()
class EchoGateway implements OnGatewayDisconnect {
  @WebSocketServer() public server!: Server;

  @SubscribeMessage(PING)
  public onPing(@MessageBody() data: unknown): unknown {
    return { echo: data };
  }

  @SubscribeMessage(JOIN)
  public async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ): Promise<string> {
    await client.join(room);
    this.server.to(room).emit(BROADCAST, GREETING);
    return 'joined';
  }

  @SubscribeMessage(SHOUT)
  public onShout(@MessageBody() text: string): {
    data: string;
    event: string;
  } {
    return { data: text, event: SHOUTED };
  }

  public handleDisconnect(client: Socket): void {
    gone.push(client.id);
  }
}

@WebSocketGateway({ namespace: ADMIN })
class AdminGateway {
  @SubscribeMessage('who')
  public onWho(): string {
    return 'admin';
  }
}

@Module({ providers: [AdminGateway, EchoGateway] })
class GatewayModule {}

export { ADMIN, BROADCAST, GREETING, GatewayModule, JOIN, PING, ROOM, SHOUT, SHOUTED, gone };
