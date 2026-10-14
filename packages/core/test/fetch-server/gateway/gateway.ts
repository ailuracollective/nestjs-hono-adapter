import 'reflect-metadata';

import { Injectable, Module } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import { DOUBLING } from './hosts.ts';

@Injectable()
@WebSocketGateway({ path: '/ws' })
class PingGateway {
  /** Answers with the doubled amount. */
  @SubscribeMessage('ping')
  public ping(
    @MessageBody() data: { readonly amount: number },
  ): { readonly doubled: number } {
    return { doubled: data.amount * DOUBLING };
  }
}

/** The module that wires the gateway fixture. */
@Module({ providers: [PingGateway] })
class GatewayModule {}

export { GatewayModule, PingGateway };
