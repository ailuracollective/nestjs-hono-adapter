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
  {
    headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'bench' },
    id: 'inertia',
    method: 'GET',
    path: '/inertia',
  },
  { id: 'inertia-html', method: 'GET', path: '/inertia' },
  { id: 'inertia-react', method: 'GET', path: '/inertia-react?created=1' },
  { id: 'inertia-react-form', method: 'GET', path: '/inertia-react/form?error=email' },
  {
    body: JSON.stringify({ email: 'grace@example.com', name: 'Grace Hopper' }),
    contentType: 'application/json',
    id: 'inertia-react-submit',
    method: 'POST',
    path: '/inertia-react/form',
  },
  { id: 'inertia-vue', method: 'GET', path: '/inertia-vue?created=1' },
  { id: 'inertia-vue-form', method: 'GET', path: '/inertia-vue/form?error=email' },
  {
    body: JSON.stringify({ email: 'grace@example.com', name: 'Grace Hopper' }),
    contentType: 'application/json',
    id: 'inertia-vue-submit',
    method: 'POST',
    path: '/inertia-vue/form',
  },
  { id: 'inertia-svelte', method: 'GET', path: '/inertia-svelte?created=1' },
  { id: 'inertia-svelte-form', method: 'GET', path: '/inertia-svelte/form?error=email' },
  {
    body: JSON.stringify({ email: 'grace@example.com', name: 'Grace Hopper' }),
    contentType: 'application/json',
    id: 'inertia-svelte-submit',
    method: 'POST',
    path: '/inertia-svelte/form',
  },
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
