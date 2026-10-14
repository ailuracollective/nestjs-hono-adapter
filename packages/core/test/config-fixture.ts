import 'reflect-metadata';

export {
  ENV_FILE,
  EXPANDED_ENV_FILE,
  databaseConfig,
} from './config-fixture/controllers.ts';
export type { Database } from './config-fixture/controllers.ts';
export {
  APP_NAME_SCHEMA,
  requireAppName,
} from './config-fixture/validation.ts';
export {
  configured,
  withCache,
  withEnvFile,
  withExpandedEnvFile,
  withRejectedConfig,
  withRegisteredSlice,
  withSkipProcessEnv,
  withTransformingValidate,
  withUnexpandedEnvFile,
  withValidate,
  withValidationSchema,
} from './config-fixture/builders.ts';
