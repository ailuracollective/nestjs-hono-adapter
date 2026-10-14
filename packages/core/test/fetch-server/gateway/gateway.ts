import 'reflect-metadata';

import { Injectable, Module } from '@nestjs/common';
import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

import { DOUBLING } from './hosts.ts';

@Injectable()
@WebSocketGateway({ path: '/ws' })
class PingGateway {
  @SubscribeMessage('ping')
  public ping(@MessageBody() data: { readonly amount: number }): { readonly doubled: number } {
    return { doubled: data.amount * DOUBLING };
  }
}

@Module({ providers: [PingGateway] })
class GatewayModule {}

export { GatewayModule, PingGateway };
