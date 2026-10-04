/**
 * A parameter name, which both dialects write the same way. The
 * whole match is the name, so the expression captures nothing.
 */
const PARAMETER = /^[A-Za-z0-9_]+/u;

/** The name of a wildcard, which the v8 syntax spells `*rest`. */
const WILDCARD = /^[A-Za-z0-9_]+/u;

/** An optional segment, which the v8 syntax spells `{/:id}`. */
const OPTIONAL_SEGMENT =
  /^:(?<name>[A-Za-z0-9_]+)(?:\((?<constraint>[^()]*)\))?\??$/u;

/** The characters this translator has no meaning for. */
const REFUSED = new Set(['}', '(', ')']);

const MISSING = -1;

function unsupported(path: string): TypeError {
  return new TypeError(
    `The route path "${path}" is not one the Hono adapter ` +
      'can translate. Write it the way Hono reads it: ' +
      '`:name`, `:name?`, `:name{regex}`, `{/:name}` or `*`.',
  );
}

function withoutLeadingSlash(content: string): string {
  if (content.startsWith('/')) {
    return content.slice(1);
  }
  return content;
}

/**
 * Translates one optional segment. Hono can only make a single
 * parameter optional, so a group that holds a literal or more
 * than one segment is refused instead of quietly ignored.
 */
function translateGroup(content: string, path: string): string {
  const match = OPTIONAL_SEGMENT.exec(
    withoutLeadingSlash(content),
  );
  if (match === null) {
    throw unsupported(path);
  }
  const { constraint, name } = match.groups ?? {
    constraint: undefined,
    name: '',
  };
  if (constraint === undefined) {
    return `/:${name}?`;
  }
  return `/:${name}{${constraint}}?`;
}

/**
 * Rewrites one route path into the dialect Hono's router reads.
 *
 * The two differ in three places: a constraint is written
 * `:id(\\d+)` rather than `:id{\\d+}`, an optional segment is
 * written `{/:id}` rather than `/:id?`, and a named wildcard is
 * written `*rest` rather than `*`. Anything else is refused
 * with the path that caused it, because a route that is
 * registered but never matches is worse than one that fails at
 * startup.
 */
class PathTranslator {
  private index = 0;
  private translated = '';
  private readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }

  public translate(): string {
    while (this.index < this.path.length) {
      this.step();
    }
    return this.translated;
  }

  private step(): void {
    const character = this.path.charAt(this.index);
    if (REFUSED.has(character)) {
      throw unsupported(this.path);
    }
    if (this.readSpecial(character)) {
      return;
    }
    this.emit(character);
    this.index += 1;
  }

  /** Copies a character, or handles the ones that mean more. */
  private readSpecial(character: string): boolean {
    if (character === '{') {
      this.readGroup();
    } else if (character === ':') {
      this.readParameter();
    } else if (character === '*') {
      this.readWildcard();
    } else {
      return false;
    }
    return true;
  }

  private emit(text: string): void {
    this.translated += text;
  }

  private readGroup(): void {
    const end = this.path.indexOf('}', this.index);
    if (end === MISSING) {
      throw unsupported(this.path);
    }
    const content = this.path.slice(this.index + 1, end);
    this.emit(translateGroup(content, this.path));
    this.index = end + 1;
  }

  private readParameter(): void {
    const match = PARAMETER.exec(
      this.path.slice(this.index + 1),
    );
    if (match === null) {
      this.emit(':');
      this.index += 1;
      return;
    }
    const [name] = match;
    this.index += name.length + 1;
    this.closeParameter(name);
  }

  private closeParameter(name: string): void {
    if (this.path.charAt(this.index) !== '(') {
      this.emit(`:${name}`);
      return;
    }
    const end = this.path.indexOf(')', this.index);
    if (end === MISSING) {
      throw unsupported(this.path);
    }
    const constraint = this.path.slice(this.index + 1, end);
    this.emit(`:${name}{${constraint}}`);
    this.index = end + 1;
  }

  private readWildcard(): void {
    const match = WILDCARD.exec(
      this.path.slice(this.index + 1),
    );
    this.emit('*');
    if (match === null) {
      this.index += 1;
      return;
    }
    const [name] = match;
    this.index += name.length + 1;
  }
}

function toHonoPath(path: string): string {
  return new PathTranslator(path).translate();
}

export { toHonoPath };
