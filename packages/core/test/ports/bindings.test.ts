import { describe, expect, test } from 'bun:test';

import { CarrierSocket, remoteAddressOf, RequestCarrier } from '#adapter/core/ports/bindings';

describe('remoteAddressOf', () => {
  test('returns undefined when remote is null', () => {
    // oxlint-disable-next-line unicorn/no-null -- the port hands null when no address is bound.
    expect(remoteAddressOf(null)).toBeUndefined();
  });

  test('returns address when remote is a SocketAddress', () => {
    expect(remoteAddressOf({ address: '127.0.0.1', family: 'IPv4', port: 8080 })).toBe('127.0.0.1');
  });
});

describe('CarrierSocket', () => {
  test('stores remoteAddress', () => {
    const socket = new CarrierSocket('10.0.0.1');
    expect(socket.remoteAddress).toBe('10.0.0.1');
  });

  test('accepts undefined remoteAddress', () => {
    const socket = new CarrierSocket(undefined);
    expect(socket.remoteAddress).toBeUndefined();
  });
});

describe('RequestCarrier', () => {
  test('creates a socket with the given remoteAddress', () => {
    const carrier = new RequestCarrier('192.168.1.1');
    expect(carrier.socket.remoteAddress).toBe('192.168.1.1');
  });

  test('has httpVersionMajor of 1', () => {
    const carrier = new RequestCarrier(undefined);
    expect(carrier.httpVersionMajor).toBe(1);
  });
});
