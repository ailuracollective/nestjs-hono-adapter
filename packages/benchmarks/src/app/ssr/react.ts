import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { PageObject, SsrResult } from '@dudousxd/nestjs-inertia';

import { Form } from './react/form.js';
import { Home } from './react/home.js';

const pages: Record<string, ComponentType<never>> = {
  'React/Form': Form,
  'React/Home': Home,
};

async function render(page: PageObject): Promise<SsrResult> {
  const result: SsrResult = await createInertiaApp({
    // The client Page type declares response-only fields the server adapter does not send.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    page: page as never,
    render: renderToString,
    resolve: (name: string) => ({ default: pages[name] ?? Home }),
    setup: ({
      App,
      props,
    }: {
      App: ComponentType<Record<string, unknown>>;
      props: Record<string, unknown>;
    }) => createElement(App, props),
  });
  return result;
}

export { render };
