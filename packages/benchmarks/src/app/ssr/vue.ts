import { createInertiaApp } from '@inertiajs/vue3';
import type { Component, Plugin } from 'vue';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { PageObject, SsrResult } from '@dudousxd/nestjs-inertia';

import Form from './vue/form.vue';
import Home from './vue/home.vue';

const pages: Record<string, Component> = {
  'Vue/Form': Form,
  'Vue/Home': Home,
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
      plugin,
    }: {
      App: Component;
      props: Record<string, unknown>;
      plugin: Plugin;
    }) => {
      const app = createSSRApp({ render: () => h(App, props) });
      app.use(plugin);
      return app;
    },
  });
  return result;
}

export { render };
