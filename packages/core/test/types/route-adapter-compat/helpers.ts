/** The signature a base declares for a member, or `never`. */
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

/** True when a function matches the documented contract. */
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

/** A base that declares the member the detection reads. */
interface BaseThatDeclares {
  beforeClose: () => void;
}

/** The option's shape where it is declared. */
interface OptionsThatDeclare {
  readonly return503OnClosing?: boolean;
}

/** The option's shape where it is not declared. */
interface OptionsThatDeclareNothing {
  readonly logger?: unknown;
}

/** A base that declares neither member. */
interface BaseThatDeclaresNeither {
  close: () => Promise<void>;
}

export type {
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
};
