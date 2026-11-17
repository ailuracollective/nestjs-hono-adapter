import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';

import { Inertia, UseInertia } from '@dudousxd/nestjs-inertia';

import type { ContactFormProps, ContactHomeProps } from './contacts.ts';
import { createContact, formProps, homeProps } from './contacts.ts';

/** The pieces of the stock Inertia service the benchmark controllers use. */
interface InertiaRequest {
  readonly inertia: { location: (url: string) => void };
}

/**
 * Redirects to the created contact list, or back to the form with the invalid field.
 *
 * @param req - Request carrying the Inertia service.
 * @param scope - Inertia feature scope (`react`, `vue`, `svelte`).
 * @param errorField - Invalid field, or `undefined` when the contact was created.
 */
const redirectAfterCreate = (
  req: InertiaRequest,
  scope: string,
  errorField: string | undefined,
): void => {
  req.inertia.location(
    errorField === undefined
      ? `/inertia-${scope}?created=1`
      : `/inertia-${scope}/form?error=${errorField}`,
  );
};

/** Inertia routes, served only by the application that mounts the Inertia module. */
@Controller()
export class InertiaController {
  /** Inertia page render, both the XHR JSON path and the first-load HTML shell. */
  @Get('inertia')
  @Inertia('Bench/Index')
  public inertia(): { items: { id: number; name: string }[]; message: string } {
    return {
      items: [{ id: 1, name: 'benchmark' }],
      message: 'Hello Inertia!',
    };
  }

  /** Inertia React contact list, including the post-create flash. */
  @Get('inertia-react')
  @UseInertia('react')
  @Inertia('React/Home')
  public inertiaReact(@Query('created') created?: string): ContactHomeProps {
    return homeProps(created);
  }

  /** Inertia React contact form, including a validation error from a failed submit. */
  @Get('inertia-react/form')
  @UseInertia('react')
  @Inertia('React/Form')
  public inertiaReactForm(@Query('error') error?: string): ContactFormProps {
    return formProps(error);
  }

  /** Inertia React form submit: validates, then redirects. */
  @Post('inertia-react/form')
  public inertiaReactSubmit(
    @Body() body: Record<string, unknown>,
    @Req() req: InertiaRequest,
  ): void {
    redirectAfterCreate(req, 'react', createContact(body));
  }

  /** Inertia Vue contact list, including the post-create flash. */
  @Get('inertia-vue')
  @UseInertia('vue')
  @Inertia('Vue/Home')
  public inertiaVue(@Query('created') created?: string): ContactHomeProps {
    return homeProps(created);
  }

  /** Inertia Vue contact form, including a validation error from a failed submit. */
  @Get('inertia-vue/form')
  @UseInertia('vue')
  @Inertia('Vue/Form')
  public inertiaVueForm(@Query('error') error?: string): ContactFormProps {
    return formProps(error);
  }

  /** Inertia Vue form submit: validates, then redirects. */
  @Post('inertia-vue/form')
  public inertiaVueSubmit(@Body() body: Record<string, unknown>, @Req() req: InertiaRequest): void {
    redirectAfterCreate(req, 'vue', createContact(body));
  }

  /** Inertia Svelte contact list, including the post-create flash. */
  @Get('inertia-svelte')
  @UseInertia('svelte')
  @Inertia('Svelte/Home')
  public inertiaSvelte(@Query('created') created?: string): ContactHomeProps {
    return homeProps(created);
  }

  /** Inertia Svelte contact form, including a validation error from a failed submit. */
  @Get('inertia-svelte/form')
  @UseInertia('svelte')
  @Inertia('Svelte/Form')
  public inertiaSvelteForm(@Query('error') error?: string): ContactFormProps {
    return formProps(error);
  }

  /** Inertia Svelte form submit: validates, then redirects. */
  @Post('inertia-svelte/form')
  public inertiaSvelteSubmit(
    @Body() body: Record<string, unknown>,
    @Req() req: InertiaRequest,
  ): void {
    redirectAfterCreate(req, 'svelte', createContact(body));
  }
}
