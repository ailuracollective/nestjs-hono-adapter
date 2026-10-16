import type { BridgeTarget, NestHono } from '@ailura/nestjs-hono-adapter';

import { registerApolloOnHono } from './apollo-register.ts';
import { patchSubscriptions } from './apollo-subscriptions.ts';
import { apolloPeer } from './peer-load.ts';
import { adapterOf, isOnHono } from './peer-read.ts';
import type { ApolloDriverConfig, ApolloDriverShape, ApolloRegisterServer } from './peer-shapes.ts';

type ApolloStart = (apolloOptions: ApolloDriverConfig) => Promise<void>;

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

const isApolloStart = (value: unknown): value is ApolloStart => typeof value === 'function';

const fitStart = (prototype: object, original: ApolloStart): void => {
  async function start(this: ApolloDriverShape, apolloOptions: ApolloDriverConfig): Promise<void> {
    const hono = honoOf(this);
    if (hono === undefined) {
      await original.call(this, apolloOptions);
      return;
    }
    await registerApolloOnHono({
      driver: this,
      hono,
      options: apolloOptions,
    });
  }
  Reflect.set(prototype, 'start', start);
};

const patchPrototype = (prototype: ApolloDriverShape): void => {
  if (patched.has(prototype)) return;
  patched.add(prototype);
  fitDriver(prototype, prototype.registerServer);
};

const patchBase = (prototype: object): void => {
  const base = Reflect.getPrototypeOf(prototype);
  if (base === null || patched.has(base)) return;
  patched.add(base);
  const original: unknown = Reflect.get(base, 'start');
  if (isApolloStart(original)) fitStart(base, original);
};

const patchApolloDriver = async (target: BridgeTarget): Promise<void> => {
  await patchSubscriptions(target);
  const peer = await apolloPeer();
  const driver = peer === undefined ? undefined : peer.ApolloDriver;
  if (driver === undefined) return;
  const { prototype } = driver;
  patchPrototype(prototype);
  patchBase(prototype);
};

export { honoOf, patchApolloDriver };
