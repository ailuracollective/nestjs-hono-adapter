import type { NestHono } from '@ailura/nestjs-hono-adapter';

import { registerApolloOnHono } from './apollo-register.ts';
import { apolloPeer } from './peer-load.ts';
import { adapterOf, isOnHono } from './peer-read.ts';
import type { ApolloDriverConfig, ApolloDriverShape, ApolloRegisterServer } from './peer-shapes.ts';

const patched = new WeakSet<object>();

const isHono = (value: unknown): value is NestHono => typeof value === 'object' && value !== null;

const honoOf = (driver: ApolloDriverShape): NestHono | undefined => {
  if (!isOnHono(driver)) {
    return undefined;
  }
  const adapter = adapterOf(driver);
  if (adapter === undefined) return undefined;
  const hono = adapter.hono();
  return isHono(hono) ? hono : undefined;
};

const fitDriver = (prototype: ApolloDriverShape, original: ApolloRegisterServer): void => {
  function registerServer(
    this: ApolloDriverShape,
    apolloOptions: ApolloDriverConfig,
  ): Promise<void> {
    const hono = honoOf(this);
    if (hono === undefined) return original.call(this, apolloOptions);
    return registerApolloOnHono({
      driver: this,
      hono,
      options: apolloOptions,
    });
  }
  prototype.registerServer = registerServer;
};

const patchApolloDriver = async (): Promise<void> => {
  const peer = await apolloPeer();
  const driver = peer === undefined ? undefined : peer.ApolloDriver;
  if (driver === undefined) return;
  const { prototype } = driver;
  if (patched.has(prototype)) {
    return;
  }
  patched.add(prototype);
  fitDriver(prototype, prototype.registerServer);
};

export { honoOf, patchApolloDriver };
