import type {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
  Type,
} from '@nestjs/common';

import type { MultipartOptions } from './multipart-options.interface.ts';

/**
 * The options a `MultipartModule` provides to every
 * interceptor.
 */
type MultipartModuleOptions = MultipartOptions;

/** Builds the module's options, for `registerAsync`. */
interface MultipartOptionsFactory {
  createMultipartOptions: () =>
    | Promise<MultipartModuleOptions>
    | MultipartModuleOptions;
}

/** What `MultipartModule.registerAsync()` accepts. */
interface MultipartModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useExisting?: Type<MultipartOptionsFactory>;
  useClass?: Type<MultipartOptionsFactory>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<MultipartModuleOptions> | MultipartModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

export type {
  MultipartModuleAsyncOptions,
  MultipartModuleOptions,
  MultipartOptionsFactory,
};
