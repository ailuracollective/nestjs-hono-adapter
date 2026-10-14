import { Module } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';

import {
  MULTIPART_MODULE_ID,
  MULTIPART_MODULE_OPTIONS,
} from './files.constants.ts';
import type {
  MultipartModuleAsyncOptions,
  MultipartModuleOptions,
  MultipartOptionsFactory,
} from './interfaces/index.ts';

/** What a half-declared `registerAsync()` is refused with. */
const missingSource = (method: string): TypeError =>
  new TypeError(
    `MultipartModule.registerAsync() needs ${method}.`,
  );

/** Provides the default options every upload interceptor reads. */
@Module({})
class MultipartModule {
  /** Builds the module with fixed options. */
  public static register(
    options: MultipartModuleOptions = {},
  ): DynamicModule {
    return {
      exports: [MULTIPART_MODULE_OPTIONS],
      module: MultipartModule,
      providers: [
        {
          provide: MULTIPART_MODULE_OPTIONS,
          useFactory: () => options,
        },
        { provide: MULTIPART_MODULE_ID, useValue: 'multipart' },
      ],
    };
  }

  /** Builds the module with options resolved from a factory. */
  public static registerAsync(
    options: MultipartModuleAsyncOptions,
  ): DynamicModule {
    return {
      exports: [MULTIPART_MODULE_OPTIONS],
      imports: options.imports ?? [],
      module: MultipartModule,
      providers: [
        ...MultipartModule.createAsyncProviders(options),
        { provide: MULTIPART_MODULE_ID, useValue: 'multipart' },
      ],
    };
  }

  /** Builds the providers `registerAsync()` needs. */
  private static createAsyncProviders(
    options: MultipartModuleAsyncOptions,
  ): Provider[] {
    if (
      options.useExisting !== undefined ||
      options.useFactory !== undefined
    ) {
      return [
        MultipartModule.createAsyncOptionsProvider(options),
      ];
    }
    const { useClass } = options;
    if (useClass === undefined) {
      throw missingSource(
        'useClass, useExisting or useFactory',
      );
    }
    return [
      MultipartModule.createAsyncOptionsProvider(options),
      { provide: useClass, useClass },
    ];
  }

  /** Builds the provider that resolves the module's options. */
  private static createAsyncOptionsProvider(
    options: MultipartModuleAsyncOptions,
  ): Provider {
    if (options.useFactory !== undefined) {
      const { inject, useFactory } = options;
      return {
        inject: inject ?? [],
        provide: MULTIPART_MODULE_OPTIONS,
        useFactory,
      };
    }
    const factoryClass =
      options.useExisting ?? options.useClass;
    if (factoryClass === undefined) {
      throw missingSource(
        'useClass, useExisting or useFactory',
      );
    }
    return {
      inject: [factoryClass],
      provide: MULTIPART_MODULE_OPTIONS,
      useFactory: (factory: MultipartOptionsFactory) =>
        factory.createMultipartOptions(),
    };
  }
}

export { MultipartModule };
