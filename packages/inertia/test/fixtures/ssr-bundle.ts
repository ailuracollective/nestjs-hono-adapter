import type { PageObject, SsrResult } from '@dudousxd/nestjs-inertia';

function render(page: PageObject): SsrResult {
  return {
    body: `<div data-server-rendered="true" id="app">SSR:${page.component}</div>`,
    head: ['<title>SSR</title>'],
  };
}

export { render };
