import 'reflect-metadata';

import { Injectable, Module } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

import { DOUBLING } from './hosts.ts';

@Injectable()
@WebSocketGateway({ path: '/ws' })
class PingGateway {
  @SubscribeMessage('ping')
  public ping(@MessageBody() data: { readonly amount: number }): {
    readonly data: { readonly doubled: number };
    readonly event: string;
  } {
    return { data: { doubled: data.amount * DOUBLING }, event: 'ping' };
  }
}

@Module({ providers: [PingGateway] })
class GatewayModule {}

export { GatewayModule, PingGateway };
