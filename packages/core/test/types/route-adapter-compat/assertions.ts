import type { ProbeApplication } from '#test/probe';
import type { HonoLifecycle } from '#adapter/core/server/hono-lifecycle';
import type { RouteAdapter } from '#adapter/core/route/route-adapter';
import type { SecurityHook } from '#adapter/core/request/body/index';
import type { ServerAdapter } from '#adapter/core/server/server-adapter';

import type {
  Assert,
  AssignsTo,
  BaseThatDeclares,
  BaseThatDeclaresNeither,
  Declared,
  IsAbsent,
  IsPresent,
  MatchesDocumented,
  OptionsThatDeclare,
  OptionsThatDeclareNothing,
} from './helpers.ts';

/** What `RouteAdapter` declares for `beforeClose`, or nothing. */
type BaseBeforeClose = Declared<RouteAdapter, 'beforeClose'>;

/** What `RouteAdapter` declares for the hook, or nothing. */
type BaseSecurityHook = Declared<
  RouteAdapter,
  'registerSecurityHook'
>;

/** The signature this repository documents for `beforeClose`. */
type DocumentedBeforeClose = () => void;

/** The signature this repository documents for the hook. */
type DocumentedSecurityHook = (hook: SecurityHook) => void;

/** The detection tells a declaration from an absence. */
type DetectionTellsADeclarationFromAnAbsence = Assert<
  IsPresent<
    Declared<BaseThatDeclares, 'beforeClose'>
  > extends true
    ? IsAbsent<Declared<BaseThatDeclaresNeither, 'beforeClose'>>
    : false
>;

/** The adapter's `beforeClose` matches the documented signature. */
type BeforeCloseMatchesTheDocumentedSignature = Assert<
  MatchesDocumented<
    HonoLifecycle['beforeClose'],
    DocumentedBeforeClose
  >
>;

/** The adapter's `beforeClose` fits the base where declared. */
type BeforeCloseFitsTheBase = Assert<
  [BaseBeforeClose] extends [never]
    ? true
    : AssignsTo<HonoLifecycle['beforeClose'], BaseBeforeClose>
>;

/** The adapter's hook matches the documented signature. */
type SecurityHookMatchesTheDocumentedSignature = Assert<
  MatchesDocumented<
    ServerAdapter['registerSecurityHook'],
    DocumentedSecurityHook
  >
>;

/** The shutdown option is accepted where it is declared. */
type Return503IsAcceptedWhereDeclared = Assert<
  AssignsTo<ProbeApplication, OptionsThatDeclare>
>;

/** The shutdown option is accepted where it is undeclared. */
type Return503IsAcceptedWhereUndeclared = Assert<
  AssignsTo<ProbeApplication, OptionsThatDeclareNothing>
>;

/** The adapter's hook fits the base where declared. */
type SecurityHookFitsTheBase = Assert<
  [BaseSecurityHook] extends [never]
    ? true
    : AssignsTo<
        ServerAdapter['registerSecurityHook'],
        BaseSecurityHook
      >
>;

export type {
  BeforeCloseFitsTheBase,
  BeforeCloseMatchesTheDocumentedSignature,
  DetectionTellsADeclarationFromAnAbsence,
  Return503IsAcceptedWhereDeclared,
  Return503IsAcceptedWhereUndeclared,
  SecurityHookFitsTheBase,
  SecurityHookMatchesTheDocumentedSignature,
};
