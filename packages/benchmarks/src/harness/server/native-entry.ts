import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
const CREATED = 201;
app.use('*', cors({ origin: '*' }));
app.get('/health', (context) => context.text('OK'));
app.get('/hello', (context) => context.json({ message: 'Hello world!' }));
app.get('/query', (context) =>
  context.json({
    limit: Number(context.req.query('limit') ?? 0),
    name: context.req.query('name') ?? 'world',
  }),
);
app.get('/users/:id', (context) => context.json({ id: context.req.param('id') }));
app.post('/echo', async (context) => context.json({ received: await context.req.json() }, CREATED));

/** Hono without Nest is a lower-bound reference, not a Nest compatibility target. */
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) throw new TypeError('a positive port is required');
const server = Bun.serve({ fetch: app.fetch, hostname: '127.0.0.1', port });
process.on('SIGTERM', () => {
  void server.stop(true);
});
