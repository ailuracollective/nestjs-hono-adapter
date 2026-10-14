const PARAMETER = /^[A-Za-z0-9_]+/u;

const OPTIONAL_SEGMENT = /^:(?<name>[A-Za-z0-9_]+)(?:\((?<constraint>[^()]*)\))?\??$/u;

const REFUSED = new Set(['}', '(', ')']);

const MISSING = -1;

const unsupported = (path: string): TypeError =>
  new TypeError(
    `The route path "${path}" is not one the Hono adapter ` +
      'can translate. Write it the way Hono reads it: ' +
      '`:name`, `:name?`, `:name{regex}`, `{/:name}` or `*`.',
  );

const withoutLeadingSlash = (content: string): string => {
  if (content.startsWith('/')) {
    return content.slice(1);
  }
  return content;
};

const translateGroup = (content: string, path: string): string => {
  const match = OPTIONAL_SEGMENT.exec(withoutLeadingSlash(content));
  if (match === null) throw unsupported(path);
  const { constraint, name } = match.groups ?? {
    constraint: undefined,
    name: '',
  };
  if (constraint === undefined) {
    return `/:${name}?`;
  }
  return `/:${name}{${constraint}}?`;
};

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

  private readSpecial(character: string): boolean {
    if (character === '{') this.readGroup();
    else if (character === ':') {
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
    if (end === MISSING) throw unsupported(this.path);
    const content = this.path.slice(this.index + 1, end);
    this.emit(translateGroup(content, this.path));
    this.index = end + 1;
  }

  private readParameter(): void {
    const match = PARAMETER.exec(this.path.slice(this.index + 1));
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
    if (end === MISSING) throw unsupported(this.path);
    const constraint = this.path.slice(this.index + 1, end);
    this.emit(`:${name}{${constraint}}`);
    this.index = end + 1;
  }

  private readWildcard(): void {
    const match = PARAMETER.exec(this.path.slice(this.index + 1));
    this.emit('*');
    if (match === null) {
      this.index += 1;
      return;
    }
    const [name] = match;
    this.index += name.length + 1;
  }
}

const toHonoPath = (path: string): string => new PathTranslator(path).translate();

export { toHonoPath };
