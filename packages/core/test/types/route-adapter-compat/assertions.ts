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

type BaseBeforeClose = Declared<RouteAdapter, 'beforeClose'>;

type BaseSecurityHook = Declared<RouteAdapter, 'registerSecurityHook'>;

type DocumentedBeforeClose = () => void;

type DocumentedSecurityHook = (hook: SecurityHook) => void;

type DetectionTellsADeclarationFromAnAbsence = Assert<
  IsPresent<Declared<BaseThatDeclares, 'beforeClose'>> extends true
    ? IsAbsent<Declared<BaseThatDeclaresNeither, 'beforeClose'>>
    : false
>;

type BeforeCloseMatchesTheDocumentedSignature = Assert<
  MatchesDocumented<HonoLifecycle['beforeClose'], DocumentedBeforeClose>
>;

type BeforeCloseFitsTheBase = Assert<
  [BaseBeforeClose] extends [never]
    ? true
    : AssignsTo<HonoLifecycle['beforeClose'], BaseBeforeClose>
>;

type SecurityHookMatchesTheDocumentedSignature = Assert<
  MatchesDocumented<ServerAdapter['registerSecurityHook'], DocumentedSecurityHook>
>;

type Return503IsAcceptedWhereDeclared = Assert<AssignsTo<ProbeApplication, OptionsThatDeclare>>;

type Return503IsAcceptedWhereUndeclared = Assert<
  AssignsTo<ProbeApplication, OptionsThatDeclareNothing>
>;

type SecurityHookFitsTheBase = Assert<
  [BaseSecurityHook] extends [never]
    ? true
    : AssignsTo<ServerAdapter['registerSecurityHook'], BaseSecurityHook>
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
