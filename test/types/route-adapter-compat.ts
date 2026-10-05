/**
 * Holds the two members that only one of the supported Nest
 * versions declares to the signature the other one does.
 *
 * `noImplicitOverride` cannot be satisfied for a member the
 * installed `@nestjs/core` may or may not declare, so both live
 * on a merged interface and are installed as own properties.
 * That leaves nothing in the library comparing either
 * declaration to the base, which is what this file is for: a
 * member that drifts away from what it is checked against has
 * to stop the build rather than reach a release.
 *
 * Nothing here runs. `tsc -p test/tsconfig.json` reads the file
 * and a mismatch is a compilation error, so the file is named
 * so that `bun test` leaves it alone as well.
 */
import type { ProbeApplication } from '../probe.ts';
import type { HonoLifecycle } from '../../src/core/hono-lifecycle.ts';
import type { RouteAdapter } from '../../src/core/route-adapter.ts';
import type {
  SecurityHook,
  ServerAdapter,
} from '../../src/core/server-adapter.ts';

/**
 * The signature a base declares for a member, and `never` for a
 * member it declares not at all. Which of the two supported
 * Nest versions has a member is the one fact this file cannot
 * be written knowing beforehand, so it is read off the
 * installed declarations rather than assumed.
 */
type Declared<Base, Member extends PropertyKey> =
  Base extends Record<Member, infer Signature>
    ? Signature
    : never;

/** Fails the build unless the type handed to it is `true`. */
type Assert<Condition extends true> = Condition;

/** True when a value of `Left` can stand in for a `Right`. */
type AssignsTo<Left, Right> = [Left] extends [Right]
  ? true
  : false;

/** True for a signature a base declares, false for `never`. */
type IsPresent<Signature> = [Signature] extends [never]
  ? false
  : true;

/** True for the `never` a base reads as a member it lacks. */
type IsAbsent<Signature> = [Signature] extends [never]
  ? true
  : false;

/**
 * True when the adapter's function takes the arguments and
 * returns the value the documented contract names. The two are
 * compared apart rather than as one function type, because a
 * function is assignable to another that returns nothing: a
 * return type that drifted away from the contract would pass a
 * check that only asked for assignability, which is exactly the
 * drift this file exists to catch. Comparing the return type on
 * its own has no such gap.
 */
type MatchesDocumented<
  Adapter extends (...args: never[]) => unknown,
  Documented extends (...args: never[]) => unknown,
> =
  AssignsTo<
    Parameters<Adapter>,
    Parameters<Documented>
  > extends true
    ? AssignsTo<
        ReturnType<Adapter>,
        ReturnType<Documented>
      > extends true
      ? true
      : false
    : false;

/**
 * A base that declares the member the detection is read
 * against. Only the installed `@nestjs/core` says anything
 * about the two members this file holds, so a detection that
 * read `never` for both of them would pass every other check
 * here, and this is what says it does not.
 */
interface BaseThatDeclares {
  beforeClose: () => void;
}

/**
 * A base that declares neither member, which is the shape Nest
 * 11 gives. The detection is read against it as well, so the
 * arm a Nest 11 install takes is checked here too instead of
 * only there.
 */
/**
 * The option's two shapes, which is the same question about a
 * different declaration: Nest declares `return503OnClosing` on
 * `NestApplicationOptions` in some versions and not in others,
 * and the probe has to accept the option either way. Both arms
 * are held here so the check runs against each instead of only
 * against whichever Nest is installed.
 */
interface OptionsThatDeclare {
  readonly return503OnClosing?: boolean;
}

interface OptionsThatDeclareNothing {
  readonly logger?: unknown;
}

interface BaseThatDeclaresNeither {
  close: () => Promise<void>;
}

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

/**
 * The adapter's `beforeClose` is the signature this repository
 * documents. Nest 12 declares `beforeClose(): void` and Nest 11
 * declares nothing, so the documented signature is the one both
 * installs answer to, and it is what holds the adapter's own
 * member to the return type it promises.
 */
type BeforeCloseMatchesTheDocumentedSignature = Assert<
  MatchesDocumented<
    HonoLifecycle['beforeClose'],
    DocumentedBeforeClose
  >
>;

/**
 * The adapter's `beforeClose` fits the signature the base
 * declares, whenever the base declares one, and is checked as
 * an assignment because the base is free to widen what it
 * returns and is not free to narrow it. Under Nest 11 the base
 * declares no member at all and the assertion above is the one
 * that holds the member.
 */
type BeforeCloseFitsTheBase = Assert<
  [BaseBeforeClose] extends [never]
    ? true
    : AssignsTo<HonoLifecycle['beforeClose'], BaseBeforeClose>
>;

/**
 * The adapter's hook is the signature this repository
 * documents, which is the only arm that holds on both installs:
 * Nest 12 returns `any` where this repository returns `void`,
 * so an equality against the base would be a check of Nest's
 * own choice rather than of this adapter.
 */
type SecurityHookMatchesTheDocumentedSignature = Assert<
  MatchesDocumented<
    ServerAdapter['registerSecurityHook'],
    DocumentedSecurityHook
  >
>;

/**
 * The adapter's hook fits the signature the base declares,
 * whenever the base declares one, and is checked as an
 * assignment because the base is free to return something
 * broader than the `void` this repository installs. Under Nest
 * 11 the base declares no member at all and the assertion above
 * is the one that holds the member.
 */
type Return503IsAcceptedWhereDeclared = Assert<
  AssignsTo<ProbeApplication, OptionsThatDeclare>
>;

type Return503IsAcceptedWhereUndeclared = Assert<
  AssignsTo<ProbeApplication, OptionsThatDeclareNothing>
>;

type SecurityHookFitsTheBase = Assert<
  [BaseSecurityHook] extends [never]
    ? true
    : AssignsTo<
        ServerAdapter['registerSecurityHook'],
        BaseSecurityHook
      >
>;

export type {
  Return503IsAcceptedWhereDeclared,
  Return503IsAcceptedWhereUndeclared,
  BeforeCloseFitsTheBase,
  BeforeCloseMatchesTheDocumentedSignature,
  DetectionTellsADeclarationFromAnAbsence,
  SecurityHookFitsTheBase,
  SecurityHookMatchesTheDocumentedSignature,
};
