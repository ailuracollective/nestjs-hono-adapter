import { createSSRApp, defineComponent, h } from 'vue';
import type { DefineComponent, Plugin } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createInertiaApp } from '@inertiajs/vue3';
import type { PageObject, SsrResult } from '@dudousxd/nestjs-inertia';

const PageComponent = defineComponent({
  render: () => h('div', undefined, 'Vue SSR'),
});

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
      plugin,
    }: {
      App: DefineComponent;
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
