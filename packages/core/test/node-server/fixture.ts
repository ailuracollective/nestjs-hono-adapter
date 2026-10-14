import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';

const nodeAdapter = (): ServerAdapter => new ServerAdapter({ transport: nodeServer() });

const ADAPTER_SOURCE = `${import.meta.dirname}/../../src/index.ts`;
const NODE_SOURCE = `${import.meta.dirname}/../../src/servers/node.ts`;

const TLS_CHECK = `
const { ServerAdapter } = await import(${JSON.stringify(ADAPTER_SOURCE)});
const { nodeServer } = await import(${JSON.stringify(NODE_SOURCE)});
const { Server: HttpsServer } = await import('node:https');
const secure = new ServerAdapter({ transport: nodeServer() });
secure.initHttpServer({ httpsOptions: {} });
const plain = new ServerAdapter({ transport: nodeServer() });
plain.initHttpServer({});
const answers = [
  secure.getHttpServer() instanceof HttpsServer,
  plain.getHttpServer() instanceof HttpsServer,
];
process.stdout.write(answers.join(','));
`;

const execute = (
  file: string,
  args: string[],
  done: (error: Error | null, stdout: string) => void,
): void => {
  execFile(file, args, done);
};

const runNode = promisify(execute);

export { ADAPTER_SOURCE, NODE_SOURCE, TLS_CHECK, nodeAdapter, runNode };
