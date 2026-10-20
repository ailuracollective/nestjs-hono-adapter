import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

const PING = 'ping';

const PONG = 'pong';

interface Frame {
  readonly data: unknown;
  readonly event: string;
}

/** The example gateway the Worker serves over a WebSocket. */
@WebSocketGateway({ path: '/ws' })
export class Gateway {
  /** Answers a frame, the way a Nest gateway answers one. */
  @SubscribeMessage(PING)
  public ping(@MessageBody() data: unknown): Frame {
    return { data: { pong: PONG, sent: data }, event: PING };
  }
}
