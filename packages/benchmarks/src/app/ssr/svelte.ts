import { createInertiaApp } from '@inertiajs/svelte';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import type { PageObject, SsrResult } from '@dudousxd/nestjs-inertia';

import Form from './svelte/form.svelte';
import Home from './svelte/home.svelte';

const pages: Record<string, Component<Record<string, unknown>>> = {
  'Svelte/Form': Form,
  'Svelte/Home': Home,
};

async function renderPage(page: PageObject): Promise<SsrResult> {
  const result: SsrResult = await createInertiaApp({
    // The client Page type declares response-only fields the server adapter does not send.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    page: page as never,
    resolve: (name: string) => ({ default: pages[name] ?? Home }),
    setup: ({
      App,
      props,
    }: {
      App: Component<Record<string, unknown>>;
      props: Record<string, unknown>;
    }) => render(App, { props }),
  });
  return result;
}

export { renderPage as render };
