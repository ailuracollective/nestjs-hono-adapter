import { expect, test } from 'bun:test';

import {
  bridgeNames,
  discoverBridges,
  installBridges,
  registerBridge,
  resetBridges,
  settleBridges,
} from '#adapter/compat/index';
import type { Bridge } from '#adapter/compat/index';

import { FAKE, fakeBridge, targetOver } from './fixture.ts';

const SHIPPED = ['express'];

/**
 * The names the region finds on its own once a deployment has installed the packages, in the order
 * it looks for them.
 */
const DISCOVERED = ['graphql/apollo', 'serve-static', 'ws'];

const TWO_APPLICATIONS = 2;

test('the package ships one bridge, and only that one', () => {
  resetBridges();
  expect(bridgeNames()).toStrictEqual(SHIPPED);
});

test('a deployment names no import of a bridge package', async () => {
  resetBridges();
  installBridges(targetOver());
  await settleBridges();
  expect(bridgeNames()).toStrictEqual([...SHIPPED, ...DISCOVERED]);
});

test('a discovery that runs twice registers each bridge once', async () => {
  resetBridges();
  await discoverBridges();
  const once = bridgeNames();
  await discoverBridges();
  expect(bridgeNames()).toStrictEqual(once);
  expect(once).toStrictEqual([...SHIPPED, ...DISCOVERED]);
});

test('a reset puts back the bridges the package ships', () => {
  resetBridges();
  registerBridge(fakeBridge(FAKE));
  expect(bridgeNames()).toStrictEqual([...SHIPPED, FAKE]);
  resetBridges();
  expect(bridgeNames()).toStrictEqual(SHIPPED);
});

test('a bridge is installed once per Hono application', () => {
  resetBridges();
  const bridge = fakeBridge(FAKE);
  registerBridge(bridge);
  const target = targetOver();
  installBridges(target);
  installBridges(target);
  expect(bridge.installs).toBe(1);
});

test('a second application installs the same bridge again', () => {
  resetBridges();
  const bridge = fakeBridge(FAKE);
  registerBridge(bridge);
  installBridges(targetOver());
  installBridges(targetOver());
  expect(bridge.installs).toBe(TWO_APPLICATIONS);
});

test('a second bridge under a taken name is refused', () => {
  resetBridges();
  registerBridge(fakeBridge(FAKE));
  const second = fakeBridge(FAKE);
  registerBridge(second);
  expect(bridgeNames()).toStrictEqual([...SHIPPED, FAKE]);
  expect(second.installs).toBe(0);
});

test('a bridge that throws does not take the next one down', () => {
  resetBridges();
  const failing: Bridge = {
    install: () => {
      throw new Error('refused on purpose');
    },
    name: 'failing',
  };
  const survivor = fakeBridge('survivor');
  registerBridge(failing);
  registerBridge(survivor);
  expect(() => {
    installBridges(targetOver());
  }).not.toThrow();
  expect(survivor.installs).toBe(1);
});

test('an install that resolves is settled before Nest boots', async () => {
  resetBridges();
  let installed = false;
  registerBridge({
    install: async () => {
      await Promise.resolve();
      installed = true;
    },
    name: 'slow',
  });
  installBridges(targetOver());
  expect(installed).toBe(false);
  await settleBridges();
  expect(installed).toBe(true);
});

test('an install that starts another application is drained too', async () => {
  resetBridges();
  let installed = false;
  registerBridge({
    install: async () => {
      registerBridge({
        install: async () => {
          await Promise.resolve();
          installed = true;
        },
        name: 'later',
      });
      installBridges(targetOver());
      await Promise.resolve();
    },
    name: 'outer',
  });
  installBridges(targetOver());
  await settleBridges();
  expect(installed).toBe(true);
});

test('a bridge registered by one application is installed by the next', () => {
  resetBridges();
  const later = fakeBridge('later');
  registerBridge({
    install: () => {
      registerBridge(later);
    },
    name: 'registrar',
  });
  installBridges(targetOver());
  expect(later.installs).toBe(0);
  installBridges(targetOver());
  expect(later.installs).toBe(1);
});

test('an install that rejects is reported, not thrown at the caller', () => {
  resetBridges();
  registerBridge({
    install: () => Promise.reject(new Error('refused on purpose')),
    name: 'rejecting',
  });
  installBridges(targetOver());
  expect(settleBridges()).resolves.toBeUndefined();
});

test('a bridge is handed the application and the transport', () => {
  resetBridges();
  const bridge = fakeBridge(FAKE);
  registerBridge(bridge);
  const target = targetOver();
  installBridges(target);
  const [seen] = bridge.seen;
  if (seen === undefined) throw new Error('the bridge was handed nothing');
  expect(seen.hono).toBe(target.hono);
  expect(seen.transport).toBe(target.transport);
});

test('the shipped and the discovered bridges both install', async () => {
  resetBridges();
  installBridges(targetOver());
  await settleBridges();
  expect(bridgeNames()).toStrictEqual([...SHIPPED, ...DISCOVERED]);
});
