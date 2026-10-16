import type { HttpBindings } from '@hono/node-server';
import type { Context, Hono } from 'hono';

import type { Bindings } from './ports/bindings.ts';

interface NestEnv {
  Bindings: Bindings;
}

interface NodeEnv {
  Bindings: HttpBindings;
}

type NestHono = Hono<NestEnv>;

type NestContext = Context<NestEnv>;

export type { NestEnv, NestContext, NestHono, NodeEnv };
