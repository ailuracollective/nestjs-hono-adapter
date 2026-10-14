import { NestFactory } from '@nestjs/core';

import { WsAdapter } from '@nestjs/platform-ws';

import { fetchHandler, fetchServer, webSocketFromHost } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';

import { GatewayModule } from './gateway.ts';
import type { DrivenHost } from './hosts.ts';

interface GatewayProbe {
  readonly fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}

const startGateway = async (host: DrivenHost): Promise<GatewayProbe> => {
  const adapter = new ServerAdapter({
    transport: fetchServer({
      upgradeWebSocket: webSocketFromHost(host.helper),
    }),
  });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.init();
  return {
    close: () => app.close(),
    fetch: fetchHandler(adapter.getHono()),
  };
};

export { startGateway };
export type { GatewayProbe };
