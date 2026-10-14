type Declared<Base, Member extends PropertyKey> =
  Base extends Record<Member, infer Signature> ? Signature : never;

type Assert<Condition extends true> = Condition;

type AssignsTo<Left, Right> = [Left] extends [Right] ? true : false;

type IsPresent<Signature> = [Signature] extends [never] ? false : true;

type IsAbsent<Signature> = [Signature] extends [never] ? true : false;

type MatchesDocumented<
  Adapter extends (...args: never[]) => unknown,
  Documented extends (...args: never[]) => unknown,
> =
  AssignsTo<Parameters<Adapter>, Parameters<Documented>> extends true
    ? AssignsTo<ReturnType<Adapter>, ReturnType<Documented>> extends true
      ? true
      : false
    : false;

interface BaseThatDeclares {
  beforeClose: () => void;
}

interface OptionsThatDeclare {
  readonly return503OnClosing?: boolean;
}

interface OptionsThatDeclareNothing {
  readonly logger?: unknown;
}

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
