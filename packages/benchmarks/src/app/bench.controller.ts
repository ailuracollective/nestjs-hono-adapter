import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { Inertia, UseInertia } from '@dudousxd/nestjs-inertia';

import type { ContactFormProps, ContactHomeProps } from './contacts.ts';
import { createContact, formProps, homeProps } from './contacts.ts';
import { BenchGuard } from './bench.guard.ts';
import { BenchInterceptor } from './bench.interceptor.ts';

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

/** The single Nest application every benchmark target serves. */
@Controller()
export class BenchController {
  /** Plaintext routing and keep-alive probe. */
  @Get('health')
  public health(): { ok: true } {
    return { ok: true };
  }

  /** Minimal JSON serialization benchmark route. */
  @Get('hello')
  public hello(): { message: string } {
    return { message: 'Hello world!' };
  }

  /**
   * Query string parsing benchmark route.
   *
   * @param name - Optional query name.
   * @param limit - Optional query limit.
   */
  @Get('query')
  public query(
    @Query('name') name?: string,
    @Query('limit') limit?: string,
  ): { limit: number; name: string } {
    return { limit: Number(limit ?? 0), name: name ?? 'world' };
  }

  /**
   * Route parameter parsing benchmark route.
   *
   * @param id - URL path parameter.
   */
  @Get('users/:id')
  public user(@Param('id') id: string): { id: string } {
    return { id };
  }

  /**
   * Body parsing and re-serialization benchmark route.
   *
   * @param body - The parsed request body.
   */
  @Post('echo')
  public echo(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }

  /** Pipeline benchmark route with guard and interceptor. */
  @Get('pipeline')
  @UseGuards(BenchGuard)
  @UseInterceptors(BenchInterceptor)
  public pipeline(): { ok: true } {
    return { ok: true };
  }

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

  /**
   * Exception handling benchmark route.
   *
   * @throws HttpException with 418 I_AM_A_TEAPOT status.
   */
  @Get('boom')
  public boom(): never {
    throw new HttpException('the bench teapot', HttpStatus.I_AM_A_TEAPOT);
  }
}
