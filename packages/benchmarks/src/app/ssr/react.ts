import { createElement } from 'react';
import type { ComponentType, ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createInertiaApp } from '@inertiajs/react';
import type { PageObject, SsrResult } from '@dudousxd/nestjs-inertia';

function PageComponent(): ReactElement {
  return createElement('div', undefined, 'React SSR');
}

async function render(page: PageObject): Promise<SsrResult> {
  // The client overloads do not model the server page object or its SSR return type.
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call
  const result: SsrResult = await createInertiaApp({
    // The client Page type declares response-only fields the server adapter does not send.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    page: page as never,
    render: renderToString,
    resolve: () => ({ default: PageComponent }),
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
