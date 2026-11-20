import { createInertiaApp } from '@inertiajs/react';
import type { ResolvedComponent } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

import './app.css';

void createInertiaApp({
  resolve: (name) => {
    const pages = import.meta.glob<{ default: ResolvedComponent }>('./pages/**/*.tsx', {
      eager: true,
    });
    const page = pages[`./pages/${name}.tsx`];
    if (page === undefined) throw new Error(`Page not found: ${name}`);
    return page;
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },
});
