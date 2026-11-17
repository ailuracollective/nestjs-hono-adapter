// The transport that owns a native HTTP/1 response pipes the source stream itself; the Web body is
// never read there. Every other transport reads the lazy Web stream instead.
const NODE_STREAM = Symbol.for('ailura.nestjs-hono-adapter.nodeStream');

export { NODE_STREAM };
