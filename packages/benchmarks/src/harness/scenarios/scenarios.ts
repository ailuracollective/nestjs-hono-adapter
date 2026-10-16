import type { Scenario } from '#benchmarks/harness/config/index';

/** All benchmark request scenarios across targets. */
const scenarios: readonly Scenario[] = [
  { id: 'plaintext', method: 'GET', path: '/health' },
  { id: 'json', method: 'GET', path: '/hello' },
  {
    id: 'query',
    method: 'GET',
    path: '/query?name=benchmark&limit=10',
  },
  { id: 'params', method: 'GET', path: '/users/42' },
  {
    body: JSON.stringify({ message: 'benchmark' }),
    contentType: 'application/json',
    id: 'post',
    method: 'POST',
    path: '/echo',
  },
  { id: 'pipeline', method: 'GET', path: '/pipeline' },
  { id: 'error', method: 'GET', path: '/boom' },
  {
    headers: {
      'Access-Control-Request-Method': 'GET',
      Origin: 'http://example.com',
    },
    id: 'cors',
    method: 'OPTIONS',
    path: '/hello',
  },
];

export { scenarios };
