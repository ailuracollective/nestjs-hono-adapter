import type { Scenario } from '#benchmarks/harness/config/index';

const SUBMIT_BODY = JSON.stringify({ email: 'grace@example.com', name: 'Grace Hopper' });

/** All benchmark request scenarios across targets. */
const scenarios: readonly Scenario[] = [
  { app: 'base', id: 'plaintext', method: 'GET', path: '/health' },
  { app: 'base', id: 'json', method: 'GET', path: '/hello' },
  {
    app: 'base',
    id: 'query',
    method: 'GET',
    path: '/query?name=benchmark&limit=10',
  },
  { app: 'base', id: 'params', method: 'GET', path: '/users/42' },
  {
    app: 'base',
    body: JSON.stringify({ message: 'benchmark' }),
    contentType: 'application/json',
    id: 'post',
    method: 'POST',
    path: '/echo',
  },
  { app: 'base', id: 'pipeline', method: 'GET', path: '/pipeline' },
  {
    app: 'inertia',
    headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'bench' },
    id: 'inertia',
    method: 'GET',
    path: '/inertia',
  },
  { app: 'inertia', id: 'inertia-html', method: 'GET', path: '/inertia' },
  { app: 'inertia', id: 'inertia-react', method: 'GET', path: '/inertia-react?created=1' },
  {
    app: 'inertia',
    id: 'inertia-react-form',
    method: 'GET',
    path: '/inertia-react/form?error=email',
  },
  {
    app: 'inertia',
    body: SUBMIT_BODY,
    contentType: 'application/json',
    id: 'inertia-react-submit',
    method: 'POST',
    path: '/inertia-react/form',
  },
  { app: 'inertia', id: 'inertia-vue', method: 'GET', path: '/inertia-vue?created=1' },
  {
    app: 'inertia',
    id: 'inertia-vue-form',
    method: 'GET',
    path: '/inertia-vue/form?error=email',
  },
  {
    app: 'inertia',
    body: SUBMIT_BODY,
    contentType: 'application/json',
    id: 'inertia-vue-submit',
    method: 'POST',
    path: '/inertia-vue/form',
  },
  { app: 'inertia', id: 'inertia-svelte', method: 'GET', path: '/inertia-svelte?created=1' },
  {
    app: 'inertia',
    id: 'inertia-svelte-form',
    method: 'GET',
    path: '/inertia-svelte/form?error=email',
  },
  {
    app: 'inertia',
    body: SUBMIT_BODY,
    contentType: 'application/json',
    id: 'inertia-svelte-submit',
    method: 'POST',
    path: '/inertia-svelte/form',
  },
  { app: 'base', id: 'error', method: 'GET', path: '/boom' },
  {
    app: 'base',
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
