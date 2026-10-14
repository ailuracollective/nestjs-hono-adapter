/** A parameter name, written after `:` or `*`. */
const PARAMETER = /^[A-Za-z0-9_]+/u;

/** An optional segment, which the v8 syntax spells `{/:id}`. */
const OPTIONAL_SEGMENT =
  /^:(?<name>[A-Za-z0-9_]+)(?:\((?<constraint>[^()]*)\))?\??$/u;

/** The characters this translator has no meaning for. */
const REFUSED = new Set(['}', '(', ')']);

/** The index a search of a string did not find. */
const MISSING = -1;

/** The error an untranslatable path is refused with. */
const unsupported = (path: string): TypeError =>
  new TypeError(
    `The route path "${path}" is not one the Hono adapter ` +
      'can translate. Write it the way Hono reads it: ' +
      '`:name`, `:name?`, `:name{regex}`, `{/:name}` or `*`.',
  );

/** The content without its leading slash. */
const withoutLeadingSlash = (content: string): string => {
  if (content.startsWith('/')) {
    return content.slice(1);
  }
  return content;
};

/** Translates one optional segment. */
const translateGroup = (
  content: string,
  path: string,
): string => {
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
};

/** Rewrites a route path into the dialect Hono reads. */
class PathTranslator {
  /** The position reached in the source path. */
  private index = 0;
  /** The path written so far. */
  private translated = '';
  /** The source path. */
  private readonly path: string;

  /** Builds a translator for one path. */
  public constructor(path: string) {
    this.path = path;
  }

  /** Translates the whole path. */
  public translate(): string {
    while (this.index < this.path.length) {
      this.step();
    }
    return this.translated;
  }

  /** Translates one character. */
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

  /** Handles one character that means more than itself. */
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

  /** Appends text to the translated path. */
  private emit(text: string): void {
    this.translated += text;
  }

  /** Translates one `{...}` group. */
  private readGroup(): void {
    const end = this.path.indexOf('}', this.index);
    if (end === MISSING) {
      throw unsupported(this.path);
    }
    const content = this.path.slice(this.index + 1, end);
    this.emit(translateGroup(content, this.path));
    this.index = end + 1;
  }

  /** Translates one `:name` parameter. */
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

  /** Translates a parameter's constraint, when it has one. */
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

  /** Translates one `*` wildcard. */
  private readWildcard(): void {
    const match = PARAMETER.exec(
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

/** Translates a route path for Hono's router. */
const toHonoPath = (path: string): string =>
  new PathTranslator(path).translate();

export { toHonoPath };
