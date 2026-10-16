import type {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
  Type,
} from '@nestjs/common';

import type { MultipartOptions } from './multipart-options.interface.ts';

type MultipartModuleOptions = MultipartOptions;

interface MultipartOptionsFactory {
  createMultipartOptions: () => Promise<MultipartModuleOptions> | MultipartModuleOptions;
}

interface MultipartModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<MultipartOptionsFactory>;
  useClass?: Type<MultipartOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<MultipartModuleOptions> | MultipartModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

export type { MultipartModuleAsyncOptions, MultipartModuleOptions, MultipartOptionsFactory };
