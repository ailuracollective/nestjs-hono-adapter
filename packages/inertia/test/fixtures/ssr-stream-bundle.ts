import type { PageObject, SsrResult, SsrStreamResult, SsrWritable } from '@dudousxd/nestjs-inertia';

function render(page: PageObject): SsrResult {
  return {
    body: `<div data-server-rendered="true" id="app">buffered:${page.component}</div>`,
    head: ['<title>SSR</title>'],
  };
}

function renderToStream(page: PageObject): SsrStreamResult {
  return {
    head: ['<title>Stream</title>'],
    pipe(writable: SsrWritable): void {
      writable.write('<div data-server-rendered="true" id="app">');
      writable.write(`stream:${page.component}`);
      writable.end('</div>');
    },
  };
}

export { render, renderToStream };
