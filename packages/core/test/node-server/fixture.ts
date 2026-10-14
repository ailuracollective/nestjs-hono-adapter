import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';

/** An adapter served through the Node runtime. */
const nodeAdapter = (): ServerAdapter =>
  new ServerAdapter({ transport: nodeServer() });

/** Where the adapter source lives for the Node checks. */
const ADAPTER_SOURCE = `${import.meta.dirname}/../../src/index.ts`;
/** Where the Node transport source lives for the checks. */
const NODE_SOURCE = `${import.meta.dirname}/../../src/servers/node.ts`;

/** The Node check that reads the server class. */
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

/** Runs a child process and hands its answer on. */
const execute = (
  file: string,
  args: string[],
  done: (error: Error | null, stdout: string) => void,
): void => {
  execFile(file, args, done);
};

/** Runs a check in a child process. */
const runNode = promisify(execute);

export {
  ADAPTER_SOURCE,
  NODE_SOURCE,
  TLS_CHECK,
  nodeAdapter,
  runNode,
};
